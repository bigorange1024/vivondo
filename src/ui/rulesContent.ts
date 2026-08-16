export type RulesLang = "zh" | "en";

export interface RulesSection {
  id: string;
  title: { zh: string; en: string };
  body: { zh: string[]; en: string[] };
}

/**
 * Player-facing manual. Short chapters, natural wording (not design-doc / translationese).
 */
export const RULES_SECTIONS: RulesSection[] = [
  {
    id: "basics",
    title: { zh: "开局与回合", en: "Getting started" },
    body: {
      zh: [
        "每人开局现金 5000。先各自掷两次骰子，点数高的先走；整局都按这个顺序轮着来。",
        "轮到你：掷一颗六面骰，棋子沿外圈顺时针走，停到哪格就结算哪格。走完自己的事后点继续，交给下一位。",
        "顺时针经过「银行（起点）」领 500；刚好停在起点领 1000。逆时针路过或停在起点都不领钱。",
        "银行、收费、拍卖、发牌都由电脑当 GM 自动处理，没有真人坐庄。",
      ],
      en: [
        "Everyone starts with 5000. Roll two dice each — highest total goes first, and that order sticks for the whole game.",
        "On your turn: roll one six-sided die, move clockwise on the outer ring, and resolve the tile you stop on. Then pass to the next player.",
        "Going clockwise past Bank (GO) pays you 500; landing exactly on it pays 1000. Moving counterclockwise past GO pays nothing.",
        "The computer runs the bank — paydays, fees, auctions, cards. Nobody plays as a human GM.",
      ],
    },
  },
  {
    id: "countries",
    title: { zh: "国家地产", en: "Country tiles" },
    body: {
      zh: [
        "棋盘上带国旗的格是国家地产，按大洲分成七区（亚、欧、非、南美、中美、北美、大洋洲）。亚洲和欧洲各有 5 国，其余大洲各 3～4 国。",
        "停在无主国家：可以买，也可以不买；不买不会拍卖。",
        "停在别人的国家：要交地租。普通地（还没特性化）= 基础地租 ×（1＋房屋数）。同一大洲全被同一人买齐后，这些普通地的地租再翻一倍。地主正在住院时，踩他的地不用交租。",
        "停在自己的国家：可以花一倍地价盖一层房（最多 3 层）。第 4 次加盖要花两倍地价，拆掉所有房，改成工业国、商业国或旅游国之一。也可以跳过、什么都不盖。",
        "特性化之后的地租（三种分开算；都不再享受「同区买齐翻倍」）：",
        "工业国：地租 = 基础地租 × 5。",
        "商业国：地租 = 基础地租 ×（3 × 你完整拥有的大洲数）。若完整大洲数是 0，地租就是 0。",
        "旅游国：地租 = 基础地租 ×（N + 骰子点数）。其中 N = 地主当前持有的旅游国数量，最多按 3 计（有 4 个也只算 3）；骰子点数是结算时现掷的 1～6。举例：地主有 1 个旅游国且掷出 4 → 倍数是 1＋4＝5，地租＝基础×5；有 3 个旅游国且掷出 2 → 倍数是 3＋2＝5。",
      ],
      en: [
        "Flag tiles are countries, grouped into seven continents. Asia and Europe have five countries each; the others have three or four.",
        "Land on an unowned country: buy it or skip. Skipping does not start an auction.",
        "Land on someone else's country: pay rent. For a normal (non-special) tile that's base rent × (1 + houses). If one player owns every country in that continent, those normal rents double. Skip rent if the owner is in hospital.",
        "Land on your own country: you may pay 1× the list price to add one house (up to 3). The 4th build costs 2× price, clears the houses, and you must pick Industry, Commerce, or Tourism. Or just skip building.",
        "After specializing, rent works like this (no continent double on these):",
        "Industry: rent = base rent × 5.",
        "Commerce: rent = base rent × (3 × continents you fully own). If that count is 0, rent is 0.",
        "Tourism: rent = base rent × (N + die). N is how many Tourism countries the owner has right now, capped at 3. The die is a fresh 1–6 when someone lands. Example: 1 Tourism and a roll of 4 → multiplier 5; 3 Tourism and a roll of 2 → multiplier 5.",
      ],
    },
  },
  {
    id: "facilities",
    title: { zh: "油田 · 矿山 · 港口", en: "Oil, mine & ports" },
    body: {
      zh: [
        "这三样都不是国家地产：不能盖房、不计入大洲、不能拿去拍卖。无主时踩到可以花 1000 买；不想买就跳过。缺钱时只能半价 500 退回银行；破产时银行直接收回，不给钱。别人踩到你的这些格子，也不用另付「地租」。",
        "油田（伊朗后面那格）：你付别人国家地租时，若对方地还没特性化，自动少付 10×（1＋房屋数），油田还在你手里。若对方已是工业/商业/旅游国，你要选——发动油田：只付卡面基础地租，但油田白送给银行；不发动：按抬高后的全额付，油田留下。",
        "矿山（智利后面那格）：你给自己国家加盖（含特性化那次）时，费用少 50。",
        "港口有两处（英国后、墨西哥后）。买下来后，你自己路过或停在自己的港口：有 1 个港领 20，两个港都在手里每次领 50。在任一港口可以付 200 船费开到另一港（不经过起点、不领薪）；出航后本回合结束，到了那边也不能马上再开回去。有轮船 token 可以免票，用掉即收回。",
      ],
      en: [
        "Oil field, mine, and ports aren't countries — no houses, no continent sets, no auctions. Unowned ones cost 1000 to buy, or you can skip. To raise cash you only sell them back to the bank for 500; on bankruptcy the bank takes them for free. Visitors never pay landing rent on these tiles.",
        "Oil field (after Iran): when you pay country rent, if their tile isn't specialized you automatically pay 10×(1+houses) less and keep the field. If it is specialized, choose — use the field to pay only the printed base rent, then give the field back to the bank; or pay the full special rent and keep the field.",
        "Mine (after Chile): each time you build on your own country (including specializing), the cost drops by 50.",
        "Two ports (after UK and after Mexico). When you pass or stop on a port you own: +20 if you own one, +50 if you own both. From either port you can pay 200 to sail to the other (no GO salary). That ends your turn — you can't sail again right away. A ship token lets you sail free, then the token goes back to the bank.",
      ],
    },
  },
  {
    id: "travel",
    title: { zh: "机场与代币", en: "Airport & tokens" },
    body: {
      zh: [
        "左上角机场：可选飞到任意国家地产。默认机票＝目的地地价×2；付完若还没有飞机 token 会发你一枚。手里有飞机 token 时，可以改按地价×1 飞，飞完 token 交回。有的事件让你免费飞一次。",
        "三种代币每人最多各持一枚：飞机（机场打折用）、轮船（港口免票用）、免租（付国家地租前可交回，这次地租变 0；船费、机票、赌场、罚金等都不能用）。",
        "重复领到同一种代币时不再多给；飞机、轮船通常是起飞/出航完成后才发。",
      ],
      en: [
        "Airport (top-left corner): fly to any country. Default fare is destination price ×2; after that flight you get a plane token if you don't already have one. With a plane token you can fly for ×1 instead, then hand the token back. Some events give a free flight.",
        "Three tokens, one of each max: plane (cheaper airfare), ship (free port sail), rent-free (before paying country rent, turn it in to make that rent 0 — not for fares, casino, or fines).",
        "You don't get a second copy of a token you already hold. Plane and ship tokens usually arrive right after you finish a paid flight or sail.",
      ],
    },
  },
  {
    id: "casino",
    title: { zh: "赌场（中央跑马场）", en: "Casino track" },
    body: {
      zh: [
        "外圈有两处赌城入口：顶边「蒙特卡洛赌城」（意大利后面，扑克牌图标），底边「拉斯维加斯赌城」（美国后面，筹码图标）。踩到默认进中央跑道；有赌场 VIP 卡可以弃掉取消这次进场。",
        "进场后棋子放在跑道起终点（黑白格旗那格），同一回合必须马上再掷 1 骰往前走，不能趴在起点结束回合。之后每个在场内的回合也是掷 1 骰前进。",
        "跑道一共 21 格：1 格起终点＋20 格小游戏。小游戏三种——钞票、赛马（马头图标）、老虎机。停到哪格，先掷两次骰，用「第一次减第二次」得到 D（大约 −5～＋5），再按格子算效果。",
        "钞票：金额＝D×40。D 为正银行给你钱，为负你付给银行，为 0 没事。",
        "赛马（马头）：再按 D 在跑道上进或退；停到新格会立刻再结算，可以连锁。",
        "老虎机：D 为正，免费给自己一块未满 3 屋、未特性化的国家加一层；D 为负，必须拆自己一块地（普通减 1 屋无退款；特殊地改回普通 3 屋）；D＝0 没事。老虎机不能用来做第 4 次特性化。",
        "任意一次移动（含赛马额外走动）走到或越过起终点，就离场。离场后你任选蒙特卡洛或拉斯维加斯其中一个入口回到外圈，并按那个入口格再结算一次。人在跑道里时，外面照常向你收租、追债。",
      ],
      en: [
        "Two casino doors on the outer ring: Monte Carlo on the top side (after Italy, card icon) and Las Vegas on the bottom (after the USA, chip icon). Landing there usually pulls you onto the center track. A Casino VIP card can cancel that entry if you discard it.",
        "You start on the track's start/finish (checkered flag). Same turn, you must roll 1d6 and move — you can't end the turn parked on start. Later turns on the track are also one die forward.",
        "The track has 21 spaces: start/finish plus 20 mini-game spaces — cash, racing (horse-head icon), and slots. Land on one, roll two dice, take D = first − second (about −5 to +5), then resolve that space.",
        "Cash: money = D×40. Positive pays you from the bank; negative you pay the bank; zero does nothing.",
        "Racing (horse head): move D steps on the track. If you land on a new space, resolve it right away — it can chain.",
        "Slots: D>0 free-build one house on a country you own that isn't special and has under 3 houses; D<0 you must demolish one of yours (normal: −1 house, no refund; special: back to normal with 3 houses); D=0 nothing. Slots can't specialize a tile.",
        "Any move that reaches or passes start/finish boots you off — including extra racing moves. Then pick Monte Carlo or Las Vegas, return to that outer entrance, and resolve that tile. While you're on the track, people can still charge you rent and collect debts as usual.",
      ],
    },
  },
  {
    id: "events",
    title: { zh: "事件与手牌", en: "Events & hold cards" },
    body: {
      zh: [
        "外圈带「？」的格是事件格：抽一张立刻结算（给钱、扣钱、挪格子、住院、发代币、强制拍卖等）。顶栏「事件卡堆」悬停能看还剩哪些牌。",
        "出院卡、赌场 VIP 卡可以捏在手里（各最多一张）。再抽到同名卡时，那张回牌堆，银行补给你一笔（出院 100／VIP 200）。",
        "出院卡：本来要进医院时可以弃掉取消。VIP 卡：本来要进赌场，或自己抽到强制拍卖时，可以弃掉取消。两张卡不能互相替用。",
      ],
      en: [
        "Outer “?” tiles draw an event and resolve it right away — cash, moves, hospital, tokens, forced auction, and so on. Hover the Event deck counter up top to peek at what's left.",
        "You may hold one Discharge card and one Casino VIP card. Drawing a duplicate returns that card to the deck and the bank pays you (100 for Discharge, 200 for VIP).",
        "Discharge: discard to cancel going to hospital. VIP: discard to cancel entering the casino, or to cancel a forced auction you just drew. They don't swap jobs.",
      ],
    },
  },
  {
    id: "corners",
    title: { zh: "医院与证券交易所", en: "Hospital & stock" },
    body: {
      zh: [
        "棋盘四个角分别是：左下银行（起点）、左上机场、右上医院、右下证券交易所。机场怎么飞见「机场与代币」；过起点怎么领薪见「开局与回合」。这一章只补医院和证券。",
        "进医院多半是事件把你送过去。住院期间要跳过自己接下来 2 次「掷骰＋移动」；这段时间你基本收不到钱，别人踩你的地也不用交租。唯一例外是被迫拍卖拿到的钱。若手里有出院卡，可以在入院时弃掉，取消这次住院。",
        "停在证券交易所时，按当回合界面提示往奖池里付钱或从奖池拿钱即可。",
      ],
      en: [
        "The four corners are Bank/GO (bottom-left), Airport (top-left), Hospital (top-right), and Stock Exchange (bottom-right). Flying is under Airport & tokens; GO pay is under Getting started. This chapter is just hospital and stock.",
        "Hospital usually means an event sent you there. You skip your next two roll-and-move turns. While you're in, you mostly can't collect money, and others don't pay rent on your lands — except cash from forced auctions. Discard a Discharge card on the way in to cancel the stay.",
        "On the Stock Exchange, follow the on-screen prompts to pay into or take from the prize pool that turn.",
      ],
    },
  },
  {
    id: "debt",
    title: { zh: "欠债与出局", en: "Debt & bankruptcy" },
    body: {
      zh: [
        "钱不够付账时不能直接认输：先拆自己普通地上的房（每拆一层银行退半价），再把油田／矿山／港口半价退回银行，再挑国家地拿去拍卖。",
        "拍卖时原地主不能拍。起拍价＝地价×2，一口价＝地价×10，每次至少加 50。成交额一半归原地主。流拍则地变无主，银行按规则退一点给原地主。拍完或收回后，那块地变回普通 0 屋。",
        "当玩家现金在该回合结算后不再大于 0 时，系统会逼你拆房、卖地筹资；无地可卖、无房可拆时直接破产出局。油田、矿山、港口不能拿去拍卖抵债（只可半价退回银行）。破产时剩下的国家地进入破产拍卖；油田、矿山、港口和各种代币由银行收回。",
      ],
      en: [
        "If you can't pay, you don't just resign. First demolish houses on your normal countries (half price back each), then sell oil/mine/ports back to the bank for 500, then auction countries.",
        "The owner can't bid. Opening bid is 2× list price, buyout 10×, raises by at least 50. The seller gets half the sale. If nobody buys, the bank takes the tile and refunds a bit. After a sale or pass-in, the tile resets to normal with 0 houses.",
        "If your cash is no longer above 0 after that turn's settlement, the game forces you to demolish and sell to raise money. No houses and no countries left to sell means bankruptcy. Oil, mine, and ports can't be auctioned for debt — only sold back to the bank at half price. On bankruptcy, leftover countries go to an estate auction; oil, mine, ports, and tokens return to the bank.",
      ],
    },
  },
  {
    id: "victory",
    title: { zh: "怎样算赢", en: "How you win" },
    body: {
      zh: [
        "两种赢法，先达到就算：",
        "区域称霸——完整拥有 4 个大洲的全部国家，而且这 4 个里至少有一个是 5 国大洲（亚洲或欧洲）。",
        "独占存活——其他人都破产，只剩你。单机局里如果人类全灭了，游戏直接结束，还活着的人里现金最多的赢。",
      ],
      en: [
        "You win as soon as either happens:",
        "Region sweep — fully own 4 continents, and at least one of those is a 5-country continent (Asia or Europe).",
        "Last one standing — everyone else is bankrupt. In solo play, if every human is out, the game ends and the richest survivor wins.",
      ],
    },
  },
];

export const RULES_TOC_LABEL = {
  zh: "目录",
  en: "Contents",
} as const;

export const RULES_MANUAL_TITLE = {
  zh: "游戏规则",
  en: "How to play",
} as const;
