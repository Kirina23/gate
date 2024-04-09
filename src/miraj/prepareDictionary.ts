import * as fs from "fs";

const dict = fs.readFileSync("src/miraj/Xml/Dictionaries/events_system.json");

const result: any = {};

const parsed = JSON.parse(dict.toString());

for (const param of parsed.Root.Template.Param) {
  const paramId = param["-id"];
  if (paramId) {
    result[paramId] = param["-text"];
  }
  if (param.Param && Array.isArray(param.Param)) {
    for (const subParam of param.Param) {
      result[paramId + "/" + subParam["-id"]] = subParam["-text"];
    }
  }
}

fs.writeFileSync(
  "src/miraj/events_system.json",
  JSON.stringify(result, null, 2)
);
