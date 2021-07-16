import { randomUUID } from "crypto";
import fetchRetry from "fetch-retry";
import nodeFetch from "isomorphic-fetch";
import {
  Service,
  ServiceBroker,
  Context,
  NodeHealthStatus,
  Errors,
} from "moleculer";
import dbMixin from "@webhooks-microservice/db-mixin";
const fetch = fetchRetry(nodeFetch);

enum CustomErrors {
  HOOK_CREATE_FAILED = "HOOK_CREATE_FAILED",
  HOOK_UPDATE_FAILED = "HOOK_UPDATE_FAILED",
  HOOK_LISTS_FAILED = "HOOK_LISTS_FAILED",
  HOOK_TRIGGER_FAILED = "HOOK_TRIGGER_FAILED",
}

export default class WebhookService extends Service {
  constructor(_broker: ServiceBroker) {
    super(_broker);

    this.parseServiceSchema({
      name: "webhooks",
      mixins: [dbMixin("webhooks")],
      actions: {
        health: this.health,
        register: {
          params: {
            targetUrl: "string",
          },
          handler: this.registerHook,
        },
        update: {
          params: {
            id: "string",
            newTargetUrl: "string",
          },
          handler: this.updateHook,
        },
        list: {
          handler: this.listHooks,
        },
        trigger: {
          params: {
            ipAddress: "string",
          },
          handler: this.triggerHook,
        },
      },
      entityCreated: this.entityCreated,
      entityUpdated: this.entityUpdated,
      entityRemoved: this.entityRemoved,
    });
  }

  private async registerHook(ctx: Context<{ targetUrl: string }>) {
    const { targetUrl } = ctx.params;
    const id = randomUUID();
    try {
      const _result = await this.adapter.insertOne({ id, targetUrl });
      if (!_result) {
        return {
          success: false,
          message: "Hook creation failed. Try again",
        };
      }
      return { success: true, message: "New hook created successfully", id };
    } catch (error) {
      this.logger.warn(error);
      throw new Errors.MoleculerError(
        "Hook creation failed",
        401,
        CustomErrors.HOOK_CREATE_FAILED
      );
    }
  }

  private async updateHook(ctx: Context<{ id: string; newTargetUrl: string }>) {
    const { id, newTargetUrl } = ctx.params;
    try {
      const doc = await this.adapter.collection.findOneAndUpdate(
        { id },
        { $set: { targetUrl: newTargetUrl } }
      );
      if (!doc) {
        return {
          success: false,
          message: `Hook ID - ${id} not found. Update failed, try again`,
        };
      }
      return {
        success: true,
        message: `Hook ID ${id} updated with targetUrl - ${newTargetUrl}`,
      };
    } catch (error) {
      this.logger.warn({ message: `Hook update for ${id} failed`, error });
      throw new Errors.MoleculerError(
        `Hook ID ${id} failed. Try again!`,
        401,
        CustomErrors.HOOK_UPDATE_FAILED
      );
    }
  }

  private async listHooks(ctx: Context<{}>) {
    try {
      const docs: Array<any> = await this.adapter.find({});
      if (!docs?.length) {
        return {
          success: false,
          message: `No Hooks found. Try again, after creating one`,
        };
      }
      return {
        success: true,
        message: `Hooks found successfully`,
        data: docs,
      };
    } catch (error) {
      this.logger.warn({ message: `Hooks list aggregation failed`, error });
      throw new Errors.MoleculerError(
        `Hooks list fetch failed`,
        401,
        CustomErrors.HOOK_LISTS_FAILED
      );
    }
  }

  private async triggerHook(ctx: Context<{ ipAddress: string }>) {
    try {
      const { ipAddress } = ctx.params;
      const docs: Array<any> = await this.adapter.find({});
      if (!docs?.length) {
        return {
          success: false,
          message: `No Hooks found to send triggers. Try again after creating one`,
        };
      }

      const targetUrls: string[] = docs.map((doc) => doc.targetUrl);
      const results = await WebhookService.fetchByChunks(targetUrls, {
        ipAddress,
      });

      if (results.some((status) => status !== 200)) {
        return {
          success: false,
          message: `Some triggers failed to complete. Kindly try again!`,
        };
      }
      return {
        success: true,
        message: `All triggers sent successfully`,
        data: docs,
      };
    } catch (error) {
      this.logger.warn({
        message: `Webhooks bulk targetUrls trigger failed`,
        error,
      });
      throw new Errors.MoleculerError(
        `Webhooks bulk targetUrls trigger failed`,
        401,
        CustomErrors.HOOK_TRIGGER_FAILED
      );
    }
  }

  /**
   * Get the health data for this service.
   *
   * @private
   * @param {Context} ctx
   * @returns {Promise<NodeHealthStatus>}
   * @memberof WebhookService
   */
  private health(ctx: Context): Promise<NodeHealthStatus> {
    return ctx.call("$node.health");
  }

  static async delay(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
    return;
  }

  static async fetchByChunks(
    targetUrls: Array<string>,
    data: { ipAddress: string }
  ) {
    const { ipAddress } = data;
    const chunkSize =
      targetUrls.length < 20 ? 20 : Math.floor(targetUrls.length / 10);

    // Divide array into chunks of array
    const chunkedTargetUrls = targetUrls.reduce(
      (resultArray: string[][], item, index) => {
        const chunkIndex = Math.floor(index / chunkSize);

        if (!resultArray[chunkIndex]) {
          resultArray[chunkIndex] = []; // start a new chunk
        }

        resultArray[chunkIndex].push(item);

        return resultArray;
      },
      []
    );

    const allResults: Array<number> = [];
    // Send batch requests of chunkSize asynchronously
    for (const chunkedUrls of chunkedTargetUrls) {
      const chunkResults = await Promise.all(
        chunkedUrls.map((url) =>
          fetch(url, {
            method: "POST",
            body: JSON.stringify({ ipAddress, createdAt: Date.now() }),
            headers: { "Content-Type": "application/json" },
            retries: 5,
            retryDelay: (attempt, error, response) =>
              Math.pow(2, attempt) * 500,
          })
        )
      );
      allResults.push(...chunkResults.map((res) => res.status));
      await WebhookService.delay(2000);
    }

    return allResults;
  }
}
