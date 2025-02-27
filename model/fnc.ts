import {Fn} from "sequelize/lib/utils";
import {fn,col,literal} from "sequelize";
import { Literal } from "sequelize/types/utils";

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
const query = (query: string): Literal => {
  return literal(query)
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
  return fn('ST_Within',col(column),point,+range * 0.016)
}
const latitude = (column: string): Fn => {
  return fn('ST_X',col(column))
}
const longitude = (column: string): Fn => {
  return fn('ST_Y',col(column))
}

const distance = (column:string,{latitude,longitude}) => {
  return fn('ST_Distance_Sphere',col(column),fn('ST_PointFromText', `POINT(${latitude} ${longitude})`))
}

export default {
  acos,
  cos,
  radians,
  sin,
  sum,
  within,
  point,
  longitude,
  latitude,
  distance,
  query
}