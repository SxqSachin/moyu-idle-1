import { PrismaClient } from "../../../../generated/prisma"
import { readReplicas } from '@prisma/extension-read-replicas'

let prisma = (() => {
  let prisma = new PrismaClient({
    // log: ['info', 'query', 'warn', 'error'],
      datasources: {
        db: {
          url: process.env.MYSQL_PATH, // "mysql://idle_game:1234qwer@10.3.8.5:3306/idle_game_db",
        },
      },
    });


  if (process.env.MYSQL_PATH_REPLICA) {
    prisma = prisma.$extends(
      readReplicas({
        // replicas: [
        //   new PrismaClient({
            url: process.env.MYSQL_PATH_REPLICA, // "mysql://idle_game:1234qwer@
        //   })
        // ]
      })
    )
  }

  return prisma
})()

console.log("Prisma client initialized", process.env.MYSQL_PATH, process.env.MYSQL_PATH_REPLICA);

// let res = await prisma.user.findUnique({
//   where: {
//     uuid: '19e3b86a-d32b-41b8-a21c-da72bef0d5f7'
//   }
// })

// if (Bun.isMainThread) {
//   console.log(res);

//   if (res) {
//     console.log(
//       Date.now(),
//       "Prisma client connected to main database successfully",
//       process.env.MYSQL_PATH
//     );

//     if (process.env.MYSQL_PATH_REPLICA) {
//       console.log(
//         Date.now(),
//         "Prisma client connected to replica successfully",
//         process.env.MYSQL_PATH_REPLICA
//       );
//     }
//   }
// } else {
//   console.log("Worker thread now init prisma");
// }


export { prisma }

