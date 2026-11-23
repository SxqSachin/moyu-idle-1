export const useFriendRequest = () => {
  return useState<
    {
      id: number;
      fromUserUuid: string;
      toUserUuid: string;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    }[]
  >("friendRequest", () => []);
}