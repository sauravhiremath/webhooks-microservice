[![Moleculer](https://badgen.net/badge/Powered%20by/Moleculer/0e83cd)](https://moleculer.services)

# webhooks-microservice

## Usage

Start the project with `yarn dev` command.
After starting, open the http://localhost:3000/ URL in your browser.
On the welcome page you can test the generated services via API Gateway and check the nodes & services.

In the terminal, try the following commands:

-   `nodes` - List all connected nodes.
-   `actions` - List all registered service actions.
-   `call greeter.hello` - Call the `greeter.hello` action.
-   `call greeter.welcome --name John` - Call the `greeter.welcome` action with the `name` parameter.
-   `call products.list` - List the products (call the `products.list` action).

## Services

-   **api**: API Gateway services
-   **webhooks**: Webhooks service with `trigger`, `list`, `create`, `update` and `delete` actions.

## Mixins

-   **db.mixin**: Database access mixin for services. Based on [moleculer-db](https://github.com/moleculerjs/moleculer-db#readme)

## YARN scripts

-   `yarn run dev`: Start development mode (load all services locally with hot-reload & REPL)
-   `yarn run start`: Start production mode (set `SERVICES` env variable to load certain services)
-   `yarn run cli`: Start a CLI and connect to production. Don't forget to set production namespace with `--ns` argument in script
-   `yarn run lint`: Run ESLint
-   `yarn run ci`: Run continuous test mode with watching
-   `yarn test`: Run tests & generate coverage report
-   `yarn run dc:up`: Start the stack with Docker Compose
-   `yarn run dc:down`: Stop the stack with Docker Compose
