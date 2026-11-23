import { PrismaClient } from "~/generated/prisma";
import { readReplicas } from '@prisma/extension-read-replicas'

const runtimeConfig = useRuntimeConfig()

let prisma = new PrismaClient({
  datasources: {
    db: {
      url: runtimeConfig.MYSQL_PATH
    },
  },
})
if (runtimeConfig.MYSQL_PATH_REPLICA) {
  // @ts-ignore
  prisma = prisma.$extends(
    readReplicas({
      url: runtimeConfig.MYSQL_PATH_REPLICA,
  }));
}

let res = await prisma.user.findUnique({
  where: {
    uuid: 'c8debeae-d7bd-4882-b06a-f9e7c15e45f7'
  }
})

if (res) {
  console.log(Date.now(), "Prisma client connected to main database successfully");

  if (runtimeConfig.MYSQL_PATH_REPLICA) {
    console.log(Date.now(), "Prisma client connected to replica successfully");
  }
}


export { prisma }
