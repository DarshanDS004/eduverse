const bcrypt = require('bcrypt');

async function run() {
  const password = "Siddu@123";
  const hashedPassword = await bcrypt.hash(password, 12);

  console.log("Hashed Password:", hashedPassword);
}

run();