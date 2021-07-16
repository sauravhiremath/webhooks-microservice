import compression from "compression";
import cookieParser from "cookie-parser";
import ApiGateway from "moleculer-web";
import {
  Service,
  ServiceBroker,
  Context,
  NodeHealthStatus,
  Errors,
} from "moleculer";
import admin from "firebase-admin";
import HealthCheckMixin from "@webhooks-microservice/health-check";

import serviceAccount from "./auth.json";

/**
 * WebGatewayService acts as the core gateway to access any of the internal services.
 *
 * @export
 * @class WebGatewayService
 * @extends {Service}
 */
export default class WebGatewayService extends Service {
  /**
   * Object used to communicate with the firebase authentication server.
   *
   * @private
   * @memberof WebGatewayService
   */
  private admin = admin.initializeApp(
    {
      credential: admin.credential.cert(serviceAccount as any),
      databaseURL:
        "https://eastern-surface-293816-default-rtdb.asia-southeast1.firebasedatabase.app",
    },
    "web-gateway"
  );

  /**
   * Creates an instance of WebGatewayService.
   *
   * @param {ServiceBroker} _broker
   * @memberof WebGatewayService
   */
  constructor(_broker: ServiceBroker) {
    super(_broker);

    this.parseServiceSchema({
      name: "web-gateway",
      mixins: [ApiGateway],
      middlewares: [HealthCheckMixin()],
      settings: {
        rateLimit: {
          limit: process.env.REQUESTS_PER_MINUTE || 100,
          headers: true,
          key: (req) => {
            return (
              req.headers["x-forwarded-for"] ||
              req.connection.remoteAddress ||
              req.socket.remoteAddress ||
              req.connection.socket.remoteAddress
            );
          },
        },
        cors: {
          origin: "*",
          methods: ["GET", "OPTIONS", "POST", "PATCH", "DELETE"],
          allowedHeaders: [],
          exposedHeaders: [],
          credentials: true,
          maxAge: 3600,
        },
        use: [compression(), cookieParser()],
        routes: [
          {
            path: "/api",
            authorization: true,
            aliases: {
              "POST /webhooks/register": "webhooks.register",
              "POST /webhooks/update": "webhooks.update",
              "POST /webhooks/list": "webhooks.list",
              "POST /webhooks/trigger": "webhooks.trigger",
            },
            mappingPolicy: "restrict",
            bodyParsers: {
              json: {
                strict: false,
              },
              urlencoded: {
                extended: false,
              },
            },
          },
        ],
      },
      methods: {
        authorize: this.authorize,
      },
      actions: {
        health: this.health,
      },
    });
  }

  /**
   * Verify and Decode the JWT token using the Seret.
   *
   * @private
   * @param {string} token
   * @returns {Promise<any>}
   * @memberof WebGatewayService
   */
  private verifyAndDecode(token: string): Promise<any> {
    return this.admin.auth().verifyIdToken(token);
  }

  /**
   * Authorize the request. Decode the User token and add it to the ctx meta.
   *
   * @private
   * @param {Context<any, any>} ctx
   * @param {string} route
   * @param {*} req
   * @returns
   * @memberof WebGatewayService
   */
  private async authorize(
    ctx: Context<any, any>,
    route: string,
    req: any
  ): Promise<Context<any, any>> {
    const auth = req.cookies["auth"] || req.headers["authorization"];
    if (auth === undefined || !auth?.length || !auth.startsWith("Bearer")) {
      return Promise.reject(
        new Errors.MoleculerError("No token found", 401, "NO_TOKEN_FOUND")
      );
    }

    const token = auth.slice(7);
    return this.verifyAndDecode(token)
      .then((decoded) => {
        ctx.meta.user = decoded;
        return ctx;
      })
      .catch((err) => {
        throw new Errors.MoleculerError(
          `Denined access: ${err.message}`,
          401,
          "ACCESS_DENIED"
        );
      });
  }

  /**
   * Get the health data for this service.
   *
   * @private
   * @param {Context} ctx
   * @returns {Promise<NodeHealthStatus>}
   * @memberof WebGatewayService
   */
  private health(ctx: Context): Promise<NodeHealthStatus> {
    return ctx.call("$node.health");
  }
}
