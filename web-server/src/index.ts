import express from "express";
import router from "./router";

const port = process.env.PORT || 3003;

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use("/api", router);

app.listen(port, () => {
	console.log(`Server running on http://localhost:${port}/`);
});
