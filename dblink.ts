import { MongoClient } from "mongodb";

async function getData(): Promise<any> {
  console.log("conn: starting mongo client");
  const client = new MongoClient("mongodb://192.168.0.128:27017/actur");
  const db = client.db();
  const articles = db.collection("articles");
  const ndocs = await articles.countDocuments();
  console.log("ndocs", ndocs);
  let data: any;

  try {
    data = await articles
      .find(
        {},
        // { pubdate: { $gte: start, $lt: end } },
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
    client.close();
  }

  return { totcount: ndocs, articles: data };
}

const ret = await getData();
console.log(ret);
