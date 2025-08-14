// JSON API --- https://hexdailystats.com/fulldata
// JSON API --- https://hexdailystats.com/livedata

// https://codeakk.medium.com/hex-development-data-a1b1822446fa
// https://togosh.medium.com/hex-developer-guide-3b018a943a55

// NOTE: New rows of historical full data usually get added into database about 20 minutes after 00:00:00 UTC every day
// NOTE: Live data updates every 1 minute

// TEST: Copy and run code with online javascript compiler --- https://jsfiddle.net/

test();

async function test(){
  var fullData = await getFullData();
  var liveData = await getLiveData();
  console.log(fullData[0]);
  console.log(liveData);
}

async function getFullData(){
  try {
    const resp = await fetch("https://hexdailystats.com/fulldata");
    const data = await resp.json();
    return data;
   } catch (err) {
     console.log("ERROR: " + err + "\n" + err.stack);
   }
}

async function getFullDataPulseChain(){
  try {
    const resp = await fetch("https://hexdailystats.com/fulldatapulsechain");
    const data = await resp.json();
    return data;
   } catch (err) {
     console.log("ERROR: " + err + "\n" + err.stack);
   }
}

async function getLiveData(){
  try {
    const resp = await fetch("https://hexdailystats.com/livedata");
    const data = await resp.json();
    return data;
   } catch (err) {
     console.log("ERROR: " + err + "\n" + err.stack);
   }
}

///////////////////////////////////////////////////////
// Example of Live Data
/* {
  price: 0.42054844,
  tsharePrice: 7942.7621,
  tshareRateHEX: 18889.6,
  liquidityHEX: 90852947,
  liquidityUSDC: 33034154,
  liquidityETH: 1327,
  penaltiesHEX: 239787,
  payoutPerTshare: 5.7358412946112125,
  stakedHEX: 62725703266,
  circulatingHEX: 575096545706 
} */

///////////////////////////////////////////////////////
// Example of Full Data (One Row of Array, Day 650)
/* {
  actualAPYRate: 38.07, /////////////////////////////// dailyPayoutHEX / stakedHEX * 365.25
  averageStakeLength: 5.7215174947161715,  //////////// weighted average by HEX staked
  circulatingHEX: 572253982483,
  circulatingSupplyChange: -210407411,
  currentDay: 650,
  currentStakerCount: 57301, ////////////////////////// unique addresses with active stakes (not ended and not good accounted)
  currentStakerCountChange: 618,
  currentHolders: 247580,  //////////////////////////// unique addresses with balance greater than 0
  currentHoldersChange: 883,
  dailyMintedInflationTotal: 25795634, //////////////// difference in totalHEX
  dailyPayoutHEX: 65371765.76823559, ////////////////// (totalHEX * 10000 / 100448995) + (penaltiesHEX / 2.0);
  date: "2021-09-13T00:13:49.859Z", /////////////////// coordinated universal time (UTC)
  liquidityUV2_ETH: 824,
  liquidityUV2_HEXETH: 6944897,
  liquidityUV2_HEXUSDC: 33092181,
  liquidityUV2_USDC: 13287000,
  liquidityUV2UV3_ETH: 1205,
  liquidityUV2UV3_HEX: 64065640,
  liquidityUV2UV3_USDC: 31033051,
  liquidityUV3_ETH: 381,
  liquidityUV3_HEX: 24028562,
  liquidityUV3_USDC: 17746051,
  marketCap: 229756832292.56067, ////////////////////// priceUV2UV3 * circulatingHEX
  numberOfHolders: 345115, //////////////////////////// all holders past and present
  numberOfHoldersChange: 1337,
  payoutPerTshareHEX: 5.926236223717848, ////////////// dailyPayoutHEX / totalTshares
  penaltiesHEX: 4332180,
  priceChangeUV2: -0.048,
  priceChangeUV2UV3: -10.9235214,
  priceChangeUV3: -0.0501,
  priceUV2: 0.40438774,
  priceUV2UV3: 0.40149451,
  priceUV3: 0.39932826,
  roiMultiplierFromATL: 7112.39167404783, ///////////// all time low price: $0.00005645
  stakedHEX: 62725703266,
  stakedHEXGA: 158928698.08191812, //////////////////// stakes good accounted but not ended, subset of stakedHEX
  stakedHEXGAChange: 298886.43542948365,
  stakedHEXPercent: 9.88,
  stakedHEXPercentChange: 0.04,
  stakedSupplyChange: 236203045,
  totalHEX: 634979685749, ///////////////////////////// circulatingHEX + stakedHEX
  totalStakerCount: 71380, //////////////////////////// all stakers past and present
  totalStakerCountChange: 707,
  totalTshares: 11030907.864692634,
  totalTsharesChange: -1448.1486214846373,
  totalValueLocked: 25184025497.188072, /////////////// priceUV2UV3 * stakedHEX
  tshareMarketCap: 82530714431.73062,
  tshareMarketCapToMarketCapRatio: 0.3592,
  tshareRateHEX: 18634.8,
  tshareRateIncrease: 4.200000000000728,
  tshareRateUSD: 7481.7699
  priceBTC: 46195.21830082935
  priceETH: 3417.839366766938
} */

///////////////////////////////////////////////////////
// New Values for Full Data PulseChain
/* {
  pricePulseX
  priceChangePulseX
  pricePulseX_PLS
  pricePulseX_PLSX
  pricePulseX_INC
  liquidityPulseX_HEX
  liquidityPulseX_HEXEHEX
  liquidityPulseX_EHEX
  liquidityPulseX_HEXPLS
  liquidityPulseX_PLS
  pricePulseX_PLS
  pricePulseX_PLSX
  pricePulseX_INC
} */

///////////////////////////////////////////////////////
// Example of Daily Timer
//// Set to run 20 minutes after 00:00:00 UTC every day

//// REFERENCE: https://www.npmjs.com/package/node-schedule
//const schedule = require('node-schedule');

//const rule = new schedule.RecurrenceRule();
//rule.hour = 0;
//rule.minute = 20;
//rule.tz = 'Etc/UTC';

//const job = schedule.scheduleJob(rule, function(){
//  test();
//});


// TODO: Add polling every few minutes, check latest rows date or currentDay to be greater
// CONSIDER: Add 2nd API endpoint for lastModified datetime?

// RESEARCH: Allow user to specify which values they want vs sending all of them