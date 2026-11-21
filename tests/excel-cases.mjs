// Excel functions with results from Excel's documentation / known values: checked in Moltrix Sheet by tests/smoke.mjs (Part C)
const ser = (y, m, d) => (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 864e5;
export const EXCEL_CASES = [
  ["ABS(-3)", 3], ["ROUND(2.345,2)", 2.35], ["MROUND(10,3)", 9], ["CEILING.MATH(4.1)", 5], ["FLOOR.MATH(4.9)", 4], ["MOD(-3,2)", 1], ["POWER(2,10)", 1024],
  ["SQRT(16)", 4], ["FACT(5)", 120], ["COMBIN(5,2)", 10], ["GCD(12,18)", 6], ["LCM(4,6)", 12], ["SUMPRODUCT({1,2},{3,4})", 11], ["ROMAN(1999)", "MCMXCIX"],
  ["ARABIC(\"XIV\")", 14], ["BASE(255,16)", "FF"], ["DEC2BIN(10)", "1010"], ["HEX2DEC(\"FF\")", 255], ["CONVERT(1,\"km\",\"m\")", 1000],
  ["DATE(2026,11,21)", ser(2026, 11, 21)], ["EOMONTH(DATE(2026,2,10),0)", ser(2026, 2, 28)], ["NETWORKDAYS(DATE(2026,11,2),DATE(2026,11,6))", 5],
  ["WEEKDAY(DATE(2026,11,21))", 7], ["YEARFRAC(DATE(2026,1,1),DATE(2026,7,1))", 0.5], ["DATEDIF(DATE(2020,1,1),DATE(2026,11,21),\"Y\")", 6],
  ["EDATE(DATE(2026,1,31),1)", ser(2026, 2, 28)], ["WORKDAY(DATE(2026,11,20),1)", ser(2026, 11, 23)], ["ISOWEEKNUM(DATE(2026,11,21))", 47],
  ["TEXT(0.5,\"0%\")", "50%"], ["TEXT(1234.5,\"#,##0.00\")", "1,234.50"], ["LEFT(\"Moltrix\",3)", "Mol"], ["MID(\"Moltrix\",2,3)", "olt"], ["LEN(\"Moltrix\")", 7],
  ["SUBSTITUTE(\"a-b\",\"-\",\"+\")", "a+b"], ["PROPER(\"hello world\")", "Hello World"], ["TEXTBEFORE(\"a@b\",\"@\")", "a"], ["TEXTAFTER(\"a@b\",\"@\")", "b"],
  ["VALUE(\"12.5\")", 12.5], ["NUMBERVALUE(\"1.234,5\",\",\",\".\")", 1234.5], ["REPT(\"ab\",2)", "abab"], ["CODE(\"A\")", 65], ["CHAR(66)", "B"],
  ["UNICHAR(2309)", "अ"], ["TRIM(\"  a  b \")", "a b"], ["FIND(\"t\",\"Moltrix\")", 4], ["SEARCH(\"T\",\"Moltrix\")", 4],
  ["STDEV.S({2,4,4,4,5,5,7,9})", 2.13808993529939], ["STDEV.P({2,4,4,4,5,5,7,9})", 2], ["MEDIAN({1,3,2})", 2], ["MODE.SNGL({1,2,2,3})", 2],
  ["PERCENTILE.INC({1,2,3,4},0.5)", 2.5], ["QUARTILE.INC({1,2,3,4},1)", 1.75], ["RANK.EQ(3,{1,3,5})", 2], ["LARGE({1,5,3},2)", 3],
  ["CORREL({1,2,3},{2,4,7})", 0.9933992677987828], ["SLOPE({2,4,6},{1,2,3})", 2], ["FORECAST.LINEAR(4,{2,4,6},{1,2,3})", 8],
  ["NORM.S.DIST(0,TRUE)", 0.5], ["NORM.INV(0.5,10,2)", 10], ["T.INV.2T(0.05,10)", 2.228138851986], ["BINOM.DIST(3,10,0.5,FALSE)", 0.1171875],
  ["PMT(0.1/12,12,10000)", -879.158872300099], ["FV(0.05,10,-100)", 1257.78925355488], ["NPV(0.1,100,100)", 173.553719008264],
  ["IRR({-100,60,60})", 0.130662386291808], ["NPER(0.01,-100,1000)", 10.5886444594], ["SLN(1000,100,9)", 100], ["DB(1000,100,5,1)", 369],
  ["IFS(1>2,\"a\",TRUE,\"b\")", "b"], ["SWITCH(2,1,\"a\",2,\"b\")", "b"], ["XOR(TRUE,FALSE)", true], ["IFERROR(1/0,\"x\")", "x"], ["ISNUMBER(5)", true],
  ["INDEX({1,2;3,4},2,1)", 3], ["MATCH(3,{1,3,5},0)", 2], ["XMATCH(5,{1,3,5})", 3], ["CHOOSE(2,\"a\",\"b\")", "b"], ["LOOKUP(4,{1,3,5},{\"a\",\"b\",\"c\"})", "b"],
  ["ROWS({1;2;3})", 3], ["LET(x,2,x*3)", 6], ["REDUCE(0,{1,2,3},LAMBDA(a,b,a+b))", 6], ["BITAND(12,10)", 8], ["COMPLEX(3,4)", "3+4i"], ["IMABS(\"3+4i\")", 5],
  ["ERF(1)", 0.842700792949715], ["GAMMA(5)", 24], ["BESSELJ(1.9,2)", 0.329925727692387], ["SUM(SEQUENCE(4))", 10], ["COUNT(FILTER({1,2,3,4},{1,2,3,4}>2))", 2],
  ["TAKE(SORT({3,1,2},,-1,TRUE),1,1)", 3], ["COUNTA(UNIQUE({1;1;2}))", 2], ["CONCAT(TEXTSPLIT(\"a,b\",\",\"))", "ab"], ["ARRAYTOTEXT({1,2})", "1, 2"],
  ["REGEXTEST(\"abc123\",\"\\d+\")", true], ["INDEX(VSTACK(1,2),2)", 2], ["SUMIFS(I1:I3,I1:I3,\">1\")", 5], ["AVERAGEIF(I1:I3,\">1\")", 2.5],
  ["MAXIFS(J1:J3,I1:I3,\"<3\")", 5], ["COUNTIF(I1:I3,\">=2\")", 2], ["SUBTOTAL(9,I1:I3)", 6], ["AGGREGATE(4,6,J1:J3)", 5], ["VLOOKUP(2,I1:J3,2,FALSE)", 5],
  ["INDEX(FILTERXML(\"<a><b>5</b><b>7</b></a>\",\"//b\"),2)", 7], ["ENCODEURL(\"a b\")", "a%20b"], ["ROWS(FLATTEN({1,2;3,4}))", 4]
];
