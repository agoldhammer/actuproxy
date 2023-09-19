let res: any = {};
fetch("localhost:3433/?timeframe=0")
  .then((resp) => resp.json())
  .then((data) => console.log(data));
