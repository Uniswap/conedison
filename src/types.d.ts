declare type Address = string
declare type AddressTo<T> = Record<Address, T>
declare type Nullable<T> = T | null
declare type Nullish<T> = Nullable<T> | undefined
declare type Primitive = number | string | boolean | bigint | symbol | null | undefined
