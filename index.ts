import { subHours, format } from "date-fns";
import { MongoClient } from "mongodb";

interface Timespan {
  start: string;
  end: string;
}

interface ActuData {
  ndocs: number;
  articles: any[];
  count: number;
  timespan: Timespan;
}

const uri = process.env.MONGO_URI || "mongodb://localhost:27017";

async function getData(start: Date, end: Date): Promise<ActuData> {
  // console.log("conn: starting mongo client");
  // console.log("URI", uri);
  const client = new MongoClient(uri);
  const db = client.db("actur");
  const articles = db.collection("articles");
  const ndocs = await articles.countDocuments();
  let data: any;

  try {
    data = await articles
      .find(
        { pubdate: { $gte: start, $lt: end } },
        {
          projection: {
            _id: 0,
            title: 1,
            summary: 1,
            pubdate: 1,
            pubname: 1,
            link: 1,
            hash: 1,
            cat: 1,
          },
        }
      )
      .sort({ pubdate: -1 })
      .toArray();
  } catch (error) {
    console.log("Mongodb error:", error);
  } finally {
    // console.log("closing connection");
    await client.close();
  }
  // console.log("debug getData", data.length);
  return {
    ndocs: ndocs,
    articles: data,
    count: data.length,
    timespan: {
      start: format(start, "HH:mm O"),
      end: format(end, "HH:mm O"),
    },
  };
}

const server = Bun.serve({
  port: 3433, // defaults to $BUN_PORT, $PORT, $NODE_PORT otherwise 3000
  hostname: "0.0.0.0", // defaults to "0.0.0.0"

  fetch(req) {
    // console.log("request", req);
    const url = new URL(req.url);
    const sparams = url.searchParams;
    // console.log("headers", req.headers);
    // console.log("timeframe", sparams);
    let timeframe = sparams.get("timeframe") || "0";

    // // db setup
    const timewindow = 2;
    const tf = parseInt(timeframe, 10);
    const now = new Date();
    const end: Date = subHours(now, tf * timewindow);
    const start: Date = subHours(end, timewindow);
    console.log("ActuProxy:", now);
    const reply = getData(start, end).then((res) => Response.json(res));

    return reply;
  },

  error(error) {
    return new Response(`<pre>${error}\n${error.stack}</pre>`, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  },
});

console.log(`ActuProxy serving on ${server.hostname}:${server.port}`);
