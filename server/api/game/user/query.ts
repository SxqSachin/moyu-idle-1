import { prisma } from "~/server/utils/game/db"

export default defineEventHandler(async (event) => {
  const { name } = await readBody(event)
  const user = await prisma.user.findMany({
    where: {
        name
    }
  })

  return user
})