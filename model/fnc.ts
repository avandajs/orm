import {Fn} from "sequelize/types/utils";
import {fn} from "sequelize";

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

export default {
  acos,
  cos,
  radians,
  sin,
  sum

}