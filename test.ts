let res: any = {};
fetch("http://192.168.0.116:3433/?timeframe=0")
  .then((resp) => resp.json())
  .then((data) => console.log(data));
