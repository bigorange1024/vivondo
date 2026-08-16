import {
  createAuction,
  auctionPlaceBid,
  auctionPass,
  minNextBid,
  currentAuctionActor,
} from "../src/engine/auction.ts";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// Sole bidder: first bid must sell (no self-raise loop)
{
  const a = createAuction({
    tileIndex: 1,
    sellerId: "ai",
    price: 100,
    bidderIds: ["you"],
    source: "estate",
  });
  const r = auctionPlaceBid(a, "you", minNextBid(a), 5000);
  assert(r.type === "sold", `sole-bid expected sold, got ${r.type}`);
  console.log("ok sole-bid", r.type === "sold" ? r.salePrice : "");
}

// Two bidders: A bids, B passes -> sold to A
{
  let a = createAuction({
    tileIndex: 1,
    sellerId: "s",
    price: 100,
    bidderIds: ["a", "b"],
    source: "e18",
  });
  const first = currentAuctionActor(a)!;
  let r = auctionPlaceBid(a, first, minNextBid(a), 5000);
  assert(r.type === "continue", `two-bid expected continue, got ${r.type}`);
  a = r.auction;
  const rival = a.activeIds.find((id) => id !== a.highBidderId)!;
  r = auctionPass(a, rival);
  assert(r.type === "sold", `pass-last-rival expected sold, got ${r.type}`);
  assert(
    r.type === "sold" && r.buyerId === first,
    "buyer should be first bidder",
  );
  console.log("ok pass-last-rival");
}

// Self-raise would have been: sole bidder raises multiple times
{
  const a = createAuction({
    tileIndex: 1,
    sellerId: "s",
    price: 50,
    bidderIds: ["you"],
    source: "debt",
  });
  const r = auctionPlaceBid(a, "you", 150, 5000);
  assert(r.type === "sold", `sole-150 expected sold, got ${r.type}`);
  console.log("ok sole-150");
}

console.log("all auction sole-bidder checks passed");
