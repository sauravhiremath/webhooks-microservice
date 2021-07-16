import DbService from "moleculer-db";
import MongoAdapter from "moleculer-db-adapter-mongo";

export default function (collection: string) {
  return {
    name: "db-service",
    mixins: [DbService],
    adapter: new MongoAdapter(
      "mongodb://webhooks-mongo-mongodb.default.svc.cluster.local:27017",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    ),
    collection,
  };
}
