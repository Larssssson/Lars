import { resetDatabase, TEST_DATABASE_URL } from "../test-db";

export default async function setup() {
  await resetDatabase(TEST_DATABASE_URL);
}
