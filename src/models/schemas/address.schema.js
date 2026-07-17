import { Schema } from "mongoose";

const AddressSchema = new Schema(
  {
    // user's own label for the address, e.g. "Kuća", "Posao" - not sensitive, purely UI
    label: {
      type: String,
      trim: true,
      default: "",
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    postalCode: {
      type: String,
      required: true,
      trim: true,
    },
    // encrypted ciphertext at rest - the more precisely-identifying part of the address
    street: {
      type: String,
      required: true,
    },
    number: {
      type: String,
      required: true,
    },
    // hash of the full plaintext address (city|street|number|postalCode) - lets us
    // detect "is this the same address the user already has saved" without decrypting
    // every stored address to compare
    hash: {
      type: String,
      index: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default AddressSchema;