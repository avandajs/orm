import {Fn} from "sequelize/lib/utils";
import {fn,col} from "sequelize";

const acos = (value: unknown): Fn => {
  return fn('ACOS',value)
}
const cos = (value: unknown): Fn => {
  return fn('COS',value)
}
const radians = (value: unknown): Fn => {
  return fn('RADIANS',value)
}
const sin = (value: unknown): Fn => {
  return fn('SIN',value)
}

const sum = (value: unknown): Fn => {
  return fn('SIN',value)
}

// let range = 10;
// where(Sequelize.fn("ST_DWithin",
// Sequelize.col("location"),
// Sequelize.fn("ST_SetSRID",
// Sequelize.fn("ST_MakePoint",long, lat), 4326),
// +range * 0.016), true)


const point = (longitude: number, latitude: number): Fn => {
  return fn('ST_SetSRID',fn('ST_MakePoint',longitude,latitude),4326)
}

const within = (column: string, point: Fn, range: number): Fn => {
  return fn('ST_DWithin',col(column),point,+range * 0.016)
}

export default {
  acos,
  cos,
  radians,
  sin,
  sum,
  within,
  point
}