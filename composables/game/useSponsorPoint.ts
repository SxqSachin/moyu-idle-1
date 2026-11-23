export const useSponsorPoint = () => {
  return useState("sponsorPoint", () => ({
    current: 0,
    max: 0,
  }));
}