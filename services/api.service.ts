import { IncomingMessage } from "http";
import { Service, ServiceBroker, Context, Errors } from "moleculer";
import { verify } from "jsonwebtoken";
import compression from "compression";
import cookieParser from "cookie-parser";
import ApiGateway from "moleculer-web";

enum CustomErrors {
	ERR_NO_TOKEN = "ERR_NO_TOKEN",
	NO_RIGHTS = "NO_RIGHTS",
}

export default class ApiService extends Service {
	public constructor(broker: ServiceBroker) {
		super(broker);
		this.parseServiceSchema({
			name: "api",
			mixins: [ApiGateway],
			settings: {
				port: process.env.PORT || 3000,
				rateLimit: {
					limit: process.env.REQUESTS_PER_MINUTE || 100,
					headers: true,
					key: (req: any) =>
						req.headers["x-forwarded-for"] ||
						req.connection.remoteAddress ||
						req.socket.remoteAddress ||
						req.connection.socket.remoteAddress,
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
						path: "/api",
						whitelist: ["**"],
						use: [],
						mergeParams: true,
						// Enable authentication. Implement the logic into `authenticate` method. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Authentication
						authentication: true,
						// Enable authorization. Implement the logic into `authorize` method. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Authorization
						authorization: true,
						autoAliases: true,
						aliases: {},
						bodyParsers: {
							json: {
								strict: false,
								limit: "1MB",
							},
							urlencoded: {
								extended: false,
								limit: "1MB",
							},
						},
						onBeforeCall: (
							ctx: Context<{}, { clientIp: string }>,
							route: any,
							req: any,
							res: any
						) => {
							ctx.meta.clientIp =
								req.headers["x-forwarded-for"] ||
								req.connection.remoteAddress ||
								req.socket.remoteAddress ||
								req.connection.socket.remoteAddress;
						},
						mappingPolicy: "all", // Available values: "all", "restrict"
						logging: true,
					},
				],
				log4XXResponses: false,
				logRequestParams: "info",
				logResponseData: "info",
				assets: {
					folder: "public",
					options: {},
				},
			},

			methods: {
				/**
				 * Verify and Decode the JWT token using the Seret.
				 *
				 * @private
				 * @param {string} token
				 * @returns {Promise<any>}
				 * @memberof AdminGatewayService
				 */
				verifyAndDecode: (token: string): Promise<any> =>
					new Promise((resolve, reject) => {
						verify(
							token,
							process.env.JWT_SECRET,
							(err: any, decoded: any) => {
								if (err) {
									reject(err);
									return;
								}
								resolve(decoded);
								return;
							}
						);
					}),

				/**
				 * Authenticate the request. It checks the `Authorization` token value in the request header.
				 * Check the token value & resolve the user by the token.
				 * The resolved user will be available in `ctx.meta.user`
				 *
				 * @param {Context} ctx
				 * @param {any} route
				 * @param {IncomingMessage} req
				 * @returns {Promise}
				 */

				authenticate: (
					ctx: Context,
					route: any,
					req: IncomingMessage
				): Promise<any> => {
					// Read the token from header
					const auth = req.headers.authorization;

					if (auth && auth.startsWith("Bearer")) {
						const token = auth.slice(7);
						return this.verifyAndDecode(token)
							.then((decoded: any) => {
								// @ts-ignore
								ctx.meta.user = decoded;
								return ctx;
							})
							.catch((err: any) => {
								this.logger.warn(err);
								throw new ApiGateway.Errors.UnAuthorizedError(
									ApiGateway.Errors.ERR_INVALID_TOKEN,
									{
										error: "Invalid Token",
									}
								);
							});
					} else {
						throw new ApiGateway.Errors.UnAuthorizedError(
							CustomErrors.ERR_NO_TOKEN,
							{
								error: "Unauthorized",
							}
						);
					}
				},

				/**
				 * Authorize the request. Check that the authenticated user has right to access the resource.
				 *
				 * @param {Context} ctx
				 * @param {Object} route
				 * @param {IncomingMessage} req
				 * @returns {Promise}
				 */

				authorize: (
					ctx: Context<any, { user: string }>,
					route: Record<string, undefined>,
					req: IncomingMessage
				): Promise<void> => {
					// Get the authenticated user.
					const user = ctx.meta.user;

					// It check the `auth` property in action schema.
					// @ts-ignore
					if (req.$action.auth === "required" && !user) {
						throw new ApiGateway.Errors.UnAuthorizedError(
							CustomErrors.NO_RIGHTS,
							{
								error: "Unauthorized",
							}
						);
					}
					return;
				},
			},
		});
	}
}
