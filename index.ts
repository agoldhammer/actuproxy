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

async function getData(
  start: Date,
  end: Date,
  txtquery: string | null
): Promise<ActuData> {
  const uri = "mongodb://192.168.0.128:27017";
  const client = new MongoClient(uri);
  //   console.log("conn: starting mongo client", uri, client);
  const db = client.db("actur");
  const articles = db.collection("articles");
  const ndocs = await articles.countDocuments();
  let data: any;
  let query = {};
  if (txtquery === null || txtquery === undefined || txtquery.length === 0) {
    console.log("omitting text search");

    query = { pubdate: { $gte: start, $lt: end } };
  } else {
    console.log("txtquery", txtquery);

    query = {
      pubdate: { $gte: start, $lt: end },
      $text: {
        $search: txtquery,
        $caseSensitive: false,
        $diacriticSensitive: false,
      },
    };
  }

  try {
    data = await articles
      .find(
        // { pubdate: { $gte: start, $lt: end } },
        query,
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
      start: format(start, "EEE HH:mm O"),
      end: format(end, "EEE HH:mm O"),
    },
  };
}

const server = Bun.serve({
  port: 33433, // defaults to $BUN_PORT, $PORT, $NODE_PORT otherwise 3000
  hostname: "0.0.0.0", // defaults to "0.0.0.0"

  fetch(req) {
    // console.log("request", req);
    const url = new URL(req.url);
    const sparams = url.searchParams;
    // console.log("headers", req.headers);
    // console.log("timeframe", sparams);
    const timeframe = sparams.get("timeframe") || "0";
    const timewindow = sparams.get("timewindow") || "2";
    const txtquery = sparams.get("txtquery");
    console.log("tq", txtquery);

    // // db setup
    // const timewindow = 2;
    const tf = parseInt(timeframe, 10);
    const tw = parseInt(timewindow, 10);
    console.log("params", tf, tw);
    const now = new Date();
    const end: Date = subHours(now, tf * tw);
    const start: Date = subHours(end, tw);
    // console.log("start/end", start, end);
    const reply = getData(start, end, txtquery).then((res) =>
      Response.json(res)
    );

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
