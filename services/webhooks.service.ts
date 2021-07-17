"use strict";
import {
	Context,
	Errors,
	NodeHealthStatus,
	Service,
	ServiceBroker,
	ServiceSchema,
} from "moleculer";
import fetchRetry from "fetch-retry";
import nodeFetch from "isomorphic-fetch";

import DbConnection from "../mixins/db.mixin";
const fetch = fetchRetry(nodeFetch);

enum CustomErrors {
	HOOK_CREATE_FAILED = "HOOK_CREATE_FAILED",
	HOOK_UPDATE_FAILED = "HOOK_UPDATE_FAILED",
	HOOK_LISTS_FAILED = "HOOK_LISTS_FAILED",
	HOOK_TRIGGER_FAILED = "HOOK_TRIGGER_FAILED",
}

export default class WebhookService extends Service {
	private DbMixin = new DbConnection("webhooks").start();

	public constructor(
		public broker: ServiceBroker,
		schema: ServiceSchema<{}> = { name: "webhooks" }
	) {
		super(broker);
		this.parseServiceSchema(
			Service.mergeSchemas(
				{
					name: "webhooks",
					mixins: [this.DbMixin],
					settings: {
						fields: ["_id", "targetUrl"],
						entityValidator: {
							targetUrl: "string|min:3",
						},
					},
					actions: {
						health: this.health,
						/**
						 * The "moleculer-db" mixin registers the following actions:
						 *  - list
						 *  - find
						 *  - count
						 *  - create
						 *  - insert
						 *  - update
						 *  - remove
						 */

						// --- ADDITIONAL ACTIONS ---

						/**
						 * Send triggers for all targetUrls.
						 */
						trigger: {
							rest: "POST /ip",
							async handler(
								ctx: Context<{}, { clientIp: string }>
							) {
								try {
									const { clientIp } = ctx.meta;
									this.logger.info(`clientIp - ${clientIp}`);
									const docs: any[] = await this.adapter.find(
										{}
									);
									if (!docs?.length) {
										throw new Errors.MoleculerError(
											"No Hooks found to send triggers. Try again after creating one",
											401,
											CustomErrors.HOOK_TRIGGER_FAILED
										);
									}

									const targetUrls: string[] = docs.map(
										(doc) => doc.targetUrl
									);
									const results =
										await WebhookService.fetchByChunks(
											targetUrls,
											{
												ipAddress: clientIp,
											}
										);

									this.logger.info(results);

									if (
										results.some(
											(status) => status === "rejected"
										)
									) {
										throw new Errors.MoleculerError(
											"Some triggers failed to complete. Kindly try again",
											401,
											CustomErrors.HOOK_TRIGGER_FAILED
										);
									}
									return {
										success: true,
										message:
											"All triggers sent successfully",
										data: docs,
									};
								} catch (error) {
									this.logger.warn({
										message:
											"Webhooks bulk targetUrls trigger failed",
										error,
									});
									throw new Errors.MoleculerError(
										"Webhooks bulk targetUrls trigger failed",
										401,
										CustomErrors.HOOK_TRIGGER_FAILED
									);
								}
							},
						},
					},
					methods: {
						/**
						 * Loading sample data to the collection.
						 * It is called in the DB.mixin after the database
						 * connection establishing & the collection is empty.
						 */
						async seedDB() {
							await this.adapter.insertMany([
								{
									targetUrl: "https://sauravmh.com",
								},
								{
									targetUrl: "https://blog.sauravmh.com",
								},
								{
									targetUrl: "https://fifa.sauravmh.com",
								},
							]);
						},
					},
				},
				schema
			)
		);
	}

	private static async delay(ms: number) {
		await new Promise((resolve) => setTimeout(resolve, ms));
		return;
	}

	private static async fetchByChunks(
		targetUrls: string[],
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
					resultArray[chunkIndex] = []; // Start a new chunk
				}

				resultArray[chunkIndex].push(item);

				return resultArray;
			},
			[]
		);

		const allResults: ("rejected" | "fulfilled")[] = [];
		// Send batch requests of chunkSize asynchronously
		for (const chunkedUrls of chunkedTargetUrls) {
			const chunkResults = await Promise.allSettled(
				chunkedUrls.map((url) =>
					fetch(url, {
						method: "POST",
						body: JSON.stringify({
							ipAddress,
							createdAt: Date.now(),
						}),
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
}
