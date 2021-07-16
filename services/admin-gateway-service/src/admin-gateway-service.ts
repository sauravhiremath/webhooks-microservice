import compression from "compression";
import cookieParser from "cookie-parser";
import ApiGateway from "moleculer-web";
import {
  Service,
  Errors,
  ServiceBroker,
  Context,
  NodeHealthStatus,
} from "moleculer";
import { verify } from "jsonwebtoken";

/**
 * AdminGatewayService exposes all access to admin users.
 *
 * @export
 * @class AdminGatewayService
 * @extends {Service}
 */
export default class AdminGatewayService extends Service {
  /**
   * Creates an instance of AdminGatewayService.
   *
   * @param {ServiceBroker} _broker
   * @memberof AdminGatewayService
   */
  constructor(_broker: ServiceBroker) {
    super(_broker);

    this.parseServiceSchema({
      name: "admin-gateway",
      mixins: [ApiGateway],
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
          credentials: false,
          maxAge: 3600,
        },
        use: [compression(), cookieParser()],
        routes: [
          {
            path: "/admin",
            // Enable in prod.
            authorization: false,
            aliases: {
              "GET /web/health": "web-gateway.health",
              "GET /gateway/health": "admin-gateway.health",

              "GET /webhooks/health": "webhooks.health",
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
   * @memberof AdminGatewayService
   */
  private verifyAndDecode(token: string): Promise<any> {
    return new Promise((resolve, reject) => {
      verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(decoded);
        return;
      });
    });
  }

  /**
   * Authorize the request. Decode the User token and add it to the ctx meta.
   *
   * @private
   * @param {Context<any, any>} ctx
   * @param {string} route
   * @param {*} req
   * @param {*} res
   * @returns
   * @memberof AdminGatewayService
   */
  private authorize(ctx: Context<any, any>, route: string, req: any, res: any) {
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
   * @memberof AdminGatewayService
   */
  private health(ctx: Context): Promise<NodeHealthStatus> {
    this.logger.info("");
    return ctx.call("$node.health");
  }
}
