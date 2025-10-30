import type { ValidateFunction } from 'ajv'
import Ajv from 'ajv'
import { NorteError } from '../router'
import type { IValidator, NorteSchema } from '../types'

export class Validator implements IValidator {
  #ajv: Ajv

  constructor() {
    this.#ajv = new Ajv({
      coerceTypes: true,
      useDefaults: true,
      removeAdditional: true,
    })
  }

  public compile(schema: NorteSchema): ValidateFunction {
    return this.#ajv.compile(schema)
  }

  public validate(validator: ValidateFunction, data: unknown): void {
    if (!validator(data)) {
      throw new NorteError(
        'INVALID_INPUT',
        `Validation failed: ${this.getErrorText(validator)}`,
      )
    }
  }

  public getErrorText(validator: ValidateFunction): string {
    return this.#ajv.errorsText(validator.errors)
  }
}
