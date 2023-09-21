let res: any = {};
fetch("http://76.24.250.55:3433/?timeframe=0")
  .then((resp) => resp.json())
  .then((data) => console.log(data));
