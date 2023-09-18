import { subHours, format } from "date-fns";

console.log("Serving on localhost:8080");

Bun.serve({
  port: 8080, // defaults to $BUN_PORT, $PORT, $NODE_PORT otherwise 3000
  hostname: "localhost", // defaults to "0.0.0.0"

  fetch(req) {
    // console.log("req", req);
    const url = new URL(req.url);
    // console.log("url", url);
    const sparams = url.searchParams;
    console.log("timeframe", sparams);
    let timeframe = "0";
    if (sparams.has("timeframe")) {
      timeframe = sparams.get("timeframe") || "0";
    } else {
      console.log("nohas");
    }

    // // db setup
    const timewindow = 2;
    // // const client = new MongoClient(process.env.MONGO_URI);
    // const client = new MongoClient("192.168.0.128");
    // const db = client.db();
    // const articles = db.collection("articles");
    // console.log("conn: starting mongo client");
    // // time setup
    // const tf = req.queryStringParameters.timeframe || "0";
    const tf = parseInt(timeframe, 10);
    // console.log("conn: timeframe:", timeframe);
    const now = new Date();
    const end = subHours(now, tf * timewindow);
    const start = subHours(end, timewindow);
    console.log("start/end", start, end);
    // let data;
    // let ndocs = 0;

    // try {
    //   data = await articles
    //     .find(
    //       { pubdate: { $gte: start, $lt: end } },
    //       {
    //         projection: {
    //           _id: 0,
    //           title: 1,
    //           summary: 1,
    //           pubdate: 1,
    //           pubname: 1,
    //           link: 1,
    //           hash: 1,
    //         },
    //       }
    //     )
    //     .sort({ pubdate: -1 })
    //     .toArray();
    //   ndocs = await articles.countDocuments();
    // } finally {
    //   client.close();
    // }
    // // console.log(data);
    // const reply = {
    //   articles: data,
    //   count: data.length,
    //   timespan: {
    //     start: format(start, "HH:mm O"),
    //     end: format(end, "HH:mm O"),
    //   },
    //   ndocs: ndocs,
    // };

    // return {
    //   statusCode: 200,
    //   body: JSON.stringify(reply),
    // };
    // return new Response("Bun proxy!");
    return Response.json({ text: "Bun proxy!", sparams: sparams });
  },
});
