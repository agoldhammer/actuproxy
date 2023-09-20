import { subHours, format } from "date-fns";
import { MongoClient } from "mongodb";

async function getData(start: Date, end: Date): Promise<any> {
  console.log("conn: starting mongo client");
  const client = new MongoClient("mongodb://192.168.0.128:27017/actur");
  const db = client.db();
  const articles = db.collection("articles");
  const ndocs = await articles.countDocuments();
  console.log("getData: ndocs", ndocs);
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
  } finally {
    console.log("closing connection");
    client.close();
  }

  return { totcount: ndocs, articles: data };
}

let _data: any;

const server = Bun.serve({
  port: 3433, // defaults to $BUN_PORT, $PORT, $NODE_PORT otherwise 3000
  hostname: "0.0.0.0", // defaults to "0.0.0.0"

  fetch(req) {
    console.log("request", req);
    const url = new URL(req.url);
    const sparams = url.searchParams;
    console.log("timeframe", sparams);
    let timeframe = sparams.get("timeframe") || "0";

    // // db setup
    const timewindow = 2;
    const tf = parseInt(timeframe, 10);
    // console.log("conn: timeframe:", timeframe);
    const now = new Date();
    const end: Date = subHours(now, tf * timewindow);
    const start: Date = subHours(end, timewindow);
    console.log("start/end", start, end);
    getData(start, end).then((res) => {
      _data = res || {};
    });

    const reply = {
      articles: _data.articles,
      count: _data.articles.length,
      timespan: {
        start: format(start, "HH:mm 0"),
        end: format(end, "HH:mm 0"),
      },
      ndocs: _data.totcount,
    };

    // return Response.json({ text: "Bun proxy!", retdata: reply });
    return Response.json(reply);
  },

  error(error) {
    return new Response(`<pre>${error}\n${error.stack}</pre>`, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  },
});

console.log(`Serving on ${server.hostname}:${server.port}`);