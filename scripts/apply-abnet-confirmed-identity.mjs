/**
 * Asigna los 164 N° ABNet MATCH_SEGURO aprobados en la auditoría de identidad.
 * La lista está copiada de ese resultado. No recalcula matches.
 * Solo escribe customers.external_customer_code cuando sigue vacío.
 *
 * Uso: npx tsx scripts/apply-abnet-confirmed-identity.mjs
 */
import { fileURLToPath } from "node:url"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

import { abnetNumberFromExternalCode, padAbnetExternalCode } from "../lib/isp/abnet-master-universe.ts"
import {
  ABNET_COMPANY_ID,
  fetchAll,
  loadEnv,
} from "./abnet-residential-sources.mjs"

export const APPROVED_AUDIT_ROWS = [
  {
    "customerId": "30bcf9bb-c703-42a3-9599-0dcdcd4161a3",
    "customerNumber": "CLI-005779",
    "abnetNumber": "6798"
  },
  {
    "customerId": "e5e7cb2c-ebc2-4047-9d66-6ca5e31987c1",
    "customerNumber": "CLI-005778",
    "abnetNumber": "6795"
  },
  {
    "customerId": "0988b0b6-899c-41ce-9bb0-1b721c383291",
    "customerNumber": "CLI-005770",
    "abnetNumber": "6793"
  },
  {
    "customerId": "942ecf32-355c-479e-b598-3b7c48f92fd8",
    "customerNumber": "CLI-005766",
    "abnetNumber": "6792"
  },
  {
    "customerId": "50b6d36e-f5cb-431f-a273-96e01d7c0f73",
    "customerNumber": "CLI-005764",
    "abnetNumber": "6790"
  },
  {
    "customerId": "c6641b29-1297-4627-9908-e2265f785044",
    "customerNumber": "CLI-005763",
    "abnetNumber": "6789"
  },
  {
    "customerId": "44923090-98e3-434e-90f5-ddd2bc4500ec",
    "customerNumber": "CLI-005762",
    "abnetNumber": "6788"
  },
  {
    "customerId": "ab3f4479-cd68-4bf1-a304-1a8f2f99b4af",
    "customerNumber": "CLI-005761",
    "abnetNumber": "6787"
  },
  {
    "customerId": "9044041b-d30a-4e4d-83d5-cf06fc0d13ee",
    "customerNumber": "CLI-005760",
    "abnetNumber": "6786"
  },
  {
    "customerId": "b71eed9f-bbd7-48c0-af81-05272f8d2b7e",
    "customerNumber": "CLI-005758",
    "abnetNumber": "6784"
  },
  {
    "customerId": "bca3e864-3f69-43af-b3ed-69500041dbef",
    "customerNumber": "CLI-005749",
    "abnetNumber": "6783"
  },
  {
    "customerId": "81c3093a-8997-470d-9f9f-0c692508d69e",
    "customerNumber": "CLI-005748",
    "abnetNumber": "6782"
  },
  {
    "customerId": "4722bae6-812b-402d-a001-383751b37f11",
    "customerNumber": "CLI-005747",
    "abnetNumber": "6781"
  },
  {
    "customerId": "2fe79650-e972-4a48-a4fe-ad3fea014c2c",
    "customerNumber": "CLI-005745",
    "abnetNumber": "6780"
  },
  {
    "customerId": "c0e59c33-b4a4-4829-95fb-0a8856059aec",
    "customerNumber": "CLI-005744",
    "abnetNumber": "6779"
  },
  {
    "customerId": "edf1c6cf-bd18-4f63-9ede-008d4cc8ba82",
    "customerNumber": "CLI-005738",
    "abnetNumber": "6778"
  },
  {
    "customerId": "a3ae246a-c24b-4183-8922-c026103ce067",
    "customerNumber": "CLI-005743",
    "abnetNumber": "6777"
  },
  {
    "customerId": "0dfc1ae7-b95b-459b-987f-f10c102ae1c2",
    "customerNumber": "CLI-005741",
    "abnetNumber": "6776"
  },
  {
    "customerId": "8577656e-954f-49da-bfca-09631f263746",
    "customerNumber": "CLI-005740",
    "abnetNumber": "6775"
  },
  {
    "customerId": "17cf8a56-8bdc-404c-a24f-ac6a21d264af",
    "customerNumber": "CLI-005739",
    "abnetNumber": "6774"
  },
  {
    "customerId": "f695ae31-3011-4fc9-91b6-ffd9f16b0c9d",
    "customerNumber": "CLI-005731",
    "abnetNumber": "6773"
  },
  {
    "customerId": "69121e43-eff1-4acf-a10d-901324d041a7",
    "customerNumber": "CLI-005730",
    "abnetNumber": "6772"
  },
  {
    "customerId": "2663bd26-0ece-4d15-a227-fc870a90a165",
    "customerNumber": "CLI-005727",
    "abnetNumber": "6771"
  },
  {
    "customerId": "dec680cf-735b-4929-8cce-62b2c057433a",
    "customerNumber": "CLI-005726",
    "abnetNumber": "6770"
  },
  {
    "customerId": "c77a6d8c-e425-4265-80b0-75ad540ca5a0",
    "customerNumber": "CLI-005724",
    "abnetNumber": "6769"
  },
  {
    "customerId": "3660cc2d-30ab-4b8f-8b45-1f41116effab",
    "customerNumber": "CLI-005716",
    "abnetNumber": "6767"
  },
  {
    "customerId": "b1849abe-450b-4c77-8c3c-0aedfbd94006",
    "customerNumber": "CLI-005717",
    "abnetNumber": "6766"
  },
  {
    "customerId": "613f396c-a538-40f7-b644-f4531f8d34ff",
    "customerNumber": "CLI-005718",
    "abnetNumber": "6765"
  },
  {
    "customerId": "013b9ffa-98cf-4cac-9538-27085a271122",
    "customerNumber": "CLI-005709",
    "abnetNumber": "6764"
  },
  {
    "customerId": "4b457289-af61-4df7-a856-b04c9338b025",
    "customerNumber": "CLI-005711",
    "abnetNumber": "6763"
  },
  {
    "customerId": "c4d83099-15d2-4796-ac2c-b12c09799885",
    "customerNumber": "CLI-005710",
    "abnetNumber": "6762"
  },
  {
    "customerId": "e2811e23-3e49-4aab-8e70-64687093f262",
    "customerNumber": "CLI-005704",
    "abnetNumber": "6761"
  },
  {
    "customerId": "72079df9-614e-44d6-b662-ec65b90ef602",
    "customerNumber": "CLI-005691",
    "abnetNumber": "6759"
  },
  {
    "customerId": "c82b10a7-e19b-4e15-b4ec-685567a17dad",
    "customerNumber": "CLI-005693",
    "abnetNumber": "6758"
  },
  {
    "customerId": "c0a86dca-8abe-49f4-86d5-8ab16512f2c2",
    "customerNumber": "CLI-005692",
    "abnetNumber": "6757"
  },
  {
    "customerId": "c55719f2-ff2c-46f1-a536-e12e192f97d5",
    "customerNumber": "CLI-005684",
    "abnetNumber": "6755"
  },
  {
    "customerId": "bd126e8f-9bec-4b38-8c73-de881b47f37c",
    "customerNumber": "CLI-005686",
    "abnetNumber": "6754"
  },
  {
    "customerId": "fdc4a929-8dee-4c81-aa1b-6abfd6a35cf1",
    "customerNumber": "CLI-005687",
    "abnetNumber": "6753"
  },
  {
    "customerId": "790a22ff-8094-4ac5-9f3d-c0ed67b594ac",
    "customerNumber": "CLI-005681",
    "abnetNumber": "6750"
  },
  {
    "customerId": "ff8623c4-2450-4831-8cfb-f23ab7d73fde",
    "customerNumber": "CLI-005675",
    "abnetNumber": "6749"
  },
  {
    "customerId": "4af94734-3f7c-4a1f-8643-e37e207f25eb",
    "customerNumber": "CLI-005674",
    "abnetNumber": "6748"
  },
  {
    "customerId": "3ac580f3-ecd5-42be-af3d-7640428de896",
    "customerNumber": "CLI-005673",
    "abnetNumber": "6747"
  },
  {
    "customerId": "67070047-d33a-4eca-a3a5-0414bd993dcc",
    "customerNumber": "CLI-005672",
    "abnetNumber": "6746"
  },
  {
    "customerId": "94e1452a-bd55-490c-9b03-b176f9487dbd",
    "customerNumber": "CLI-005665",
    "abnetNumber": "6742"
  },
  {
    "customerId": "18ed462f-76c3-4695-aee0-fa45b46cfd5c",
    "customerNumber": "CLI-005662",
    "abnetNumber": "6743"
  },
  {
    "customerId": "94e1452a-bd55-490c-9b03-b176f9487dbd",
    "customerNumber": "CLI-005665",
    "abnetNumber": "6742"
  },
  {
    "customerId": "8b9c124e-9bb2-4619-a74a-ad34b76b6e62",
    "customerNumber": "CLI-005666",
    "abnetNumber": "6741"
  },
  {
    "customerId": "7757a2d7-bae4-415c-83e6-d9aaa3d3ab29",
    "customerNumber": "CLI-005658",
    "abnetNumber": "6739"
  },
  {
    "customerId": "ceebc326-8289-4da3-98e1-3608e7eeb9ef",
    "customerNumber": "CLI-005647",
    "abnetNumber": "6733"
  },
  {
    "customerId": "a86dcae0-99df-4910-9b62-9d89b5e490c2",
    "customerNumber": "CLI-005649",
    "abnetNumber": "6732"
  },
  {
    "customerId": "fd374537-b282-4e3c-9920-f2f18a8fc78a",
    "customerNumber": "CLI-005646",
    "abnetNumber": "6730"
  },
  {
    "customerId": "3e267b08-7290-4ece-aa44-63eb4bd31e8c",
    "customerNumber": "CLI-005639",
    "abnetNumber": "6726"
  },
  {
    "customerId": "cf1c73f0-c47c-422d-b2f6-08af48f99852",
    "customerNumber": "CLI-005642",
    "abnetNumber": "6727"
  },
  {
    "customerId": "22d6f8f2-42e4-466e-9e69-3ee2367031bb",
    "customerNumber": "CLI-005636",
    "abnetNumber": "6725"
  },
  {
    "customerId": "e59234a4-82bf-4fdf-b79b-27d0045eba87",
    "customerNumber": "CLI-005637",
    "abnetNumber": "6724"
  },
  {
    "customerId": "d8acbcef-45e3-47b2-9618-b86873701fda",
    "customerNumber": "CLI-005638",
    "abnetNumber": "6723"
  },
  {
    "customerId": "b2d9a2ca-246b-42d0-ace9-d0b24ef30b1d",
    "customerNumber": "CLI-005635",
    "abnetNumber": "6722"
  },
  {
    "customerId": "6910bf8c-9904-4a4b-87a2-415c11121397",
    "customerNumber": "CLI-005632",
    "abnetNumber": "6721"
  },
  {
    "customerId": "c87fa12c-4446-401f-80ae-cb301cced80a",
    "customerNumber": "CLI-005634",
    "abnetNumber": "6720"
  },
  {
    "customerId": "6c1f92a9-88bb-488f-bfe0-5c7cacd6be10",
    "customerNumber": "CLI-005631",
    "abnetNumber": "6719"
  },
  {
    "customerId": "16039ec5-3cc1-44a8-9a96-5398e71a4380",
    "customerNumber": "CLI-005630",
    "abnetNumber": "6718"
  },
  {
    "customerId": "23fe1823-2c7a-4a23-b494-07059a85f82b",
    "customerNumber": "CLI-005621",
    "abnetNumber": "6716"
  },
  {
    "customerId": "fd6a5162-f502-43bb-8af6-56a3a3fe9089",
    "customerNumber": "CLI-005619",
    "abnetNumber": "6715"
  },
  {
    "customerId": "2faad765-b1b4-4a61-b68d-5994f95f5cf9",
    "customerNumber": "CLI-005623",
    "abnetNumber": "6714"
  },
  {
    "customerId": "9d9c5d54-624c-4809-8eb1-16146768207d",
    "customerNumber": "CLI-005613",
    "abnetNumber": "6713"
  },
  {
    "customerId": "876046b8-c0bb-40eb-829c-09fb4694142a",
    "customerNumber": "CLI-005614",
    "abnetNumber": "6712"
  },
  {
    "customerId": "29ecba27-a2a8-4423-9f96-4adc615cef29",
    "customerNumber": "CLI-005612",
    "abnetNumber": "6711"
  },
  {
    "customerId": "80318d1e-e545-4e7e-981e-10449097cce7",
    "customerNumber": "CLI-005604",
    "abnetNumber": "6708"
  },
  {
    "customerId": "e5e88615-0b9c-41df-b4e4-80c5c1318dda",
    "customerNumber": "CLI-005603",
    "abnetNumber": "6706"
  },
  {
    "customerId": "62773216-80e9-4651-8399-9f213e124fcd",
    "customerNumber": "CLI-005590",
    "abnetNumber": "6704"
  },
  {
    "customerId": "614e03e1-5e30-47b0-b521-20d92bd4ae43",
    "customerNumber": "CLI-005591",
    "abnetNumber": "6702"
  },
  {
    "customerId": "d2b690ff-e67a-4c0f-bb9a-0badc9eee57d",
    "customerNumber": "CLI-005596",
    "abnetNumber": "6700"
  },
  {
    "customerId": "87df8510-0ac9-4692-831d-7033e21b703f",
    "customerNumber": "CLI-005595",
    "abnetNumber": "6699"
  },
  {
    "customerId": "00857e02-0df8-4367-9dc7-c57b0fc28330",
    "customerNumber": "CLI-005597",
    "abnetNumber": "6698"
  },
  {
    "customerId": "bb0c014c-c006-48de-bcb9-bbc2e9ff1ac5",
    "customerNumber": "CLI-005598",
    "abnetNumber": "6697"
  },
  {
    "customerId": "b1b96e41-26eb-4b1a-a39b-8bbf22d94fbb",
    "customerNumber": "CLI-005587",
    "abnetNumber": "6696"
  },
  {
    "customerId": "384dcc68-7a01-470c-9d5a-797c69b306d3",
    "customerNumber": "CLI-005584",
    "abnetNumber": "6695"
  },
  {
    "customerId": "1c077dd7-f3db-48aa-82f2-11e45254764a",
    "customerNumber": "CLI-005586",
    "abnetNumber": "6694"
  },
  {
    "customerId": "20000878-5f5f-4457-9697-c607f5864fba",
    "customerNumber": "CLI-005570",
    "abnetNumber": "6691"
  },
  {
    "customerId": "56292544-1f8a-4335-9d54-1ea8db117be2",
    "customerNumber": "CLI-005568",
    "abnetNumber": "6689"
  },
  {
    "customerId": "3977512e-62bd-4496-819d-7e9733f6a244",
    "customerNumber": "CLI-005556",
    "abnetNumber": "6686"
  },
  {
    "customerId": "17ffcafd-d06b-49fe-b71a-9bf9f6b002b6",
    "customerNumber": "CLI-005552",
    "abnetNumber": "6684"
  },
  {
    "customerId": "52af3e24-a78b-4a5b-b24a-8ca1199505c9",
    "customerNumber": "CLI-005536",
    "abnetNumber": "6680"
  },
  {
    "customerId": "1d65ee6b-6f2c-4fd8-8c32-3cf89ec87739",
    "customerNumber": "CLI-005534",
    "abnetNumber": "6679"
  },
  {
    "customerId": "fe980f90-4e7d-4dab-af37-3147f45cae87",
    "customerNumber": "CLI-005528",
    "abnetNumber": "6678"
  },
  {
    "customerId": "71ede7c2-fcdb-4622-a7c6-7d9ff4f13565",
    "customerNumber": "CLI-005529",
    "abnetNumber": "6677"
  },
  {
    "customerId": "c4622742-b4fb-42a8-a0a7-ec4f1cb8d08b",
    "customerNumber": "CLI-005515",
    "abnetNumber": "6675"
  },
  {
    "customerId": "0af1a14d-1d3b-463e-8f16-97d495de6d61",
    "customerNumber": "CLI-005504",
    "abnetNumber": "6669"
  },
  {
    "customerId": "510522a7-9e4e-4537-af97-2c00751091cf",
    "customerNumber": "CLI-005502",
    "abnetNumber": "6666"
  },
  {
    "customerId": "8ed5ed45-b336-4ebb-9bf1-a5c0b72a9401",
    "customerNumber": "CLI-005496",
    "abnetNumber": "6665"
  },
  {
    "customerId": "c26984a9-788e-4bf2-b93b-c7bf35798cbc",
    "customerNumber": "CLI-005495",
    "abnetNumber": "6664"
  },
  {
    "customerId": "23269b25-75fa-476a-9a38-7c3e781f4fe9",
    "customerNumber": "CLI-005493",
    "abnetNumber": "6663"
  },
  {
    "customerId": "4c58b112-a887-4b1b-94d2-1c55725d1f29",
    "customerNumber": "CLI-005490",
    "abnetNumber": "6662"
  },
  {
    "customerId": "47197470-c849-4ffb-bf36-b7e99b310bbb",
    "customerNumber": "CLI-005483",
    "abnetNumber": "6660"
  },
  {
    "customerId": "e623aa6d-8274-49b6-876b-e578bb8745c0",
    "customerNumber": "CLI-005487",
    "abnetNumber": "6657"
  },
  {
    "customerId": "44a3479f-0d3c-413c-a32f-08d0bfa11903",
    "customerNumber": "CLI-005478",
    "abnetNumber": "6652"
  },
  {
    "customerId": "1992c976-8e8b-4511-8709-c51c424275c9",
    "customerNumber": "CLI-005469",
    "abnetNumber": "6651"
  },
  {
    "customerId": "9d77edae-ac81-429d-b50f-df76288fb3cc",
    "customerNumber": "CLI-005468",
    "abnetNumber": "6650"
  },
  {
    "customerId": "6ac76aee-6769-47a7-abc6-7c2420c5b951",
    "customerNumber": "CLI-005460",
    "abnetNumber": "6647"
  },
  {
    "customerId": "fad6b256-ef5e-4813-8cb2-e6aa13624593",
    "customerNumber": "CLI-005458",
    "abnetNumber": "6649"
  },
  {
    "customerId": "08568210-7a55-4b5c-bc3b-793ff35cd098",
    "customerNumber": "CLI-005461",
    "abnetNumber": "6648"
  },
  {
    "customerId": "ad81b33f-3ece-4077-8513-3791debf78e4",
    "customerNumber": "CLI-005444",
    "abnetNumber": "6646"
  },
  {
    "customerId": "5252f7cb-62f4-4c15-81dd-b861bd81f6eb",
    "customerNumber": "CLI-005352",
    "abnetNumber": "6612"
  },
  {
    "customerId": "c6e1f57f-8b41-47fc-b904-3ad0c9b5ad69",
    "customerNumber": "CLI-005437",
    "abnetNumber": "6642"
  },
  {
    "customerId": "adb318f6-7375-4022-9964-c039ebf23f37",
    "customerNumber": "CLI-005439",
    "abnetNumber": "6644"
  },
  {
    "customerId": "d715385d-c020-4a57-9794-32f2970cf887",
    "customerNumber": "CLI-005438",
    "abnetNumber": "6643"
  },
  {
    "customerId": "d1e7cab4-2c92-426b-a89d-24f1bb891222",
    "customerNumber": "CLI-005420",
    "abnetNumber": "6638"
  },
  {
    "customerId": "4a9ecec0-822c-4faa-bf85-6d1ea46d3fe2",
    "customerNumber": "CLI-005417",
    "abnetNumber": "6637"
  },
  {
    "customerId": "32ddb126-c1cf-4ff4-9da7-43c2f59ab1de",
    "customerNumber": "CLI-005430",
    "abnetNumber": "6636"
  },
  {
    "customerId": "d7e3b62a-2b78-48db-8da6-991b4f74441a",
    "customerNumber": "CLI-005424",
    "abnetNumber": "6634"
  },
  {
    "customerId": "5c34742e-715a-45e5-8522-595795155c8a",
    "customerNumber": "CLI-005418",
    "abnetNumber": "6633"
  },
  {
    "customerId": "0b902b7d-61fe-4795-b22b-fc49719045b7",
    "customerNumber": "CLI-005414",
    "abnetNumber": "6631"
  },
  {
    "customerId": "5dc63a6f-f734-45c7-a40e-857c12a692ec",
    "customerNumber": "CLI-005407",
    "abnetNumber": "6630"
  },
  {
    "customerId": "1ea050fe-b029-437e-91a1-0e5b763162ca",
    "customerNumber": "CLI-005406",
    "abnetNumber": "6629"
  },
  {
    "customerId": "f2130bf8-3601-42ca-948e-999901afcbfd",
    "customerNumber": "CLI-005403",
    "abnetNumber": "6626"
  },
  {
    "customerId": "b7c960c9-3ce4-46fe-95a1-91a184d99437",
    "customerNumber": "CLI-005404",
    "abnetNumber": "6625"
  },
  {
    "customerId": "da65b87d-3f58-4a4e-8f9e-f41ee8efc41f",
    "customerNumber": "CLI-005399",
    "abnetNumber": "6624"
  },
  {
    "customerId": "f67d78ec-b871-46f7-848b-de7810be16e2",
    "customerNumber": "CLI-005397",
    "abnetNumber": "6623"
  },
  {
    "customerId": "cb2f022d-346d-46bd-820c-52149941fdc7",
    "customerNumber": "CLI-005398",
    "abnetNumber": "6622"
  },
  {
    "customerId": "5dcc1db2-f2f0-411e-9246-980b63b8a098",
    "customerNumber": "CLI-005380",
    "abnetNumber": "6620"
  },
  {
    "customerId": "49a1a992-84f4-4e6a-b410-6464e8b0c548",
    "customerNumber": "CLI-005366",
    "abnetNumber": "6619"
  },
  {
    "customerId": "b17fccb0-0253-43e7-89be-96a537d862aa",
    "customerNumber": "CLI-005357",
    "abnetNumber": "6618"
  },
  {
    "customerId": "76749004-4bcd-42a0-aa36-98d010fbaebd",
    "customerNumber": "CLI-005356",
    "abnetNumber": "6617"
  },
  {
    "customerId": "2e487701-460a-43c9-b8bd-f9cce88d9368",
    "customerNumber": "CLI-005353",
    "abnetNumber": "6614"
  },
  {
    "customerId": "bd44ec7a-9dbd-4ae2-b0c7-e9fabc56cbd7",
    "customerNumber": "CLI-005350",
    "abnetNumber": "6608"
  },
  {
    "customerId": "9446a7df-1405-46fc-a6a3-f653adea4636",
    "customerNumber": "CLI-005332",
    "abnetNumber": "6607"
  },
  {
    "customerId": "3ef94420-0fdc-4258-a1d0-36c40ca1e4e0",
    "customerNumber": "CLI-005331",
    "abnetNumber": "6606"
  },
  {
    "customerId": "d5c2f5a0-0185-433c-997b-e111a40a6f15",
    "customerNumber": "CLI-005330",
    "abnetNumber": "6603"
  },
  {
    "customerId": "7924edf6-16f6-4349-aa83-3c7301ca2724",
    "customerNumber": "CLI-005328",
    "abnetNumber": "6601"
  },
  {
    "customerId": "190d1153-f77f-4143-8fcf-b90a57578a02",
    "customerNumber": "CLI-005320",
    "abnetNumber": "6599"
  },
  {
    "customerId": "a1497535-6f37-45ce-949a-17e5d5090910",
    "customerNumber": "CLI-005316",
    "abnetNumber": "6598"
  },
  {
    "customerId": "a0c2498e-9cbb-49cb-a7c5-67872e928fcd",
    "customerNumber": "CLI-005313",
    "abnetNumber": "6597"
  },
  {
    "customerId": "69a5d7ab-1b8c-414f-9ad8-bfeac56acf79",
    "customerNumber": "CLI-005311",
    "abnetNumber": "6595"
  },
  {
    "customerId": "1b6a9b07-dbd6-4e0a-9667-5a429fff0ed8",
    "customerNumber": "CLI-005310",
    "abnetNumber": "6594"
  },
  {
    "customerId": "3309eef8-63b7-4aa7-9110-67ac560b83cb",
    "customerNumber": "CLI-005309",
    "abnetNumber": "6593"
  },
  {
    "customerId": "8f88a9d6-12d1-41fe-a52b-52a875c04629",
    "customerNumber": "CLI-005306",
    "abnetNumber": "6591"
  },
  {
    "customerId": "4693f7f8-fb54-40f8-8a26-c9efbf7a0d97",
    "customerNumber": "CLI-005300",
    "abnetNumber": "6589"
  },
  {
    "customerId": "c909f51a-9f18-4b5b-9045-ddf4f4a2fdfe",
    "customerNumber": "CLI-005299",
    "abnetNumber": "6588"
  },
  {
    "customerId": "e8e36b0b-6841-4b9f-8023-fb80eb5a9eac",
    "customerNumber": "CLI-005298",
    "abnetNumber": "6587"
  },
  {
    "customerId": "8d8b2b57-d40b-4790-aa15-370a32823001",
    "customerNumber": "CLI-005297",
    "abnetNumber": "6586"
  },
  {
    "customerId": "eb651929-f3c0-42fc-b452-c18246193169",
    "customerNumber": "CLI-005296",
    "abnetNumber": "6585"
  },
  {
    "customerId": "ab33d669-1665-4a1f-acfd-891e2d3fe382",
    "customerNumber": "CLI-005295",
    "abnetNumber": "6584"
  },
  {
    "customerId": "9f9917f2-93a6-4b85-b511-bcc9179b3d34",
    "customerNumber": "CLI-005289",
    "abnetNumber": "6583"
  },
  {
    "customerId": "b5a30028-931f-427c-8cad-8479828172f4",
    "customerNumber": "CLI-005283",
    "abnetNumber": "6581"
  },
  {
    "customerId": "0f0f3adf-0128-4102-8f6c-14b6b6b0fc03",
    "customerNumber": "CLI-005282",
    "abnetNumber": "6580"
  },
  {
    "customerId": "37a54d84-4e18-4db6-8868-80045a99ed82",
    "customerNumber": "CLI-005281",
    "abnetNumber": "6579"
  },
  {
    "customerId": "07fecacc-ccde-48a5-8faa-ecb3fcb4a6c5",
    "customerNumber": "CLI-005280",
    "abnetNumber": "6578"
  },
  {
    "customerId": "61fb8d6b-715f-4f54-a946-57e3e6cf2cda",
    "customerNumber": "CLI-005279",
    "abnetNumber": "6577"
  },
  {
    "customerId": "c1a2be86-93c7-4e42-8ae6-1af485ddd280",
    "customerNumber": "CLI-005272",
    "abnetNumber": "6575"
  },
  {
    "customerId": "34fcb95b-6adc-4808-a846-58f3c6983c04",
    "customerNumber": "CLI-005269",
    "abnetNumber": "6572"
  },
  {
    "customerId": "1457a391-8c38-4a94-a9d8-165ffcbd0698",
    "customerNumber": "CLI-005268",
    "abnetNumber": "6571"
  },
  {
    "customerId": "df702052-fc55-4d6f-a5ed-55ffc4954f6b",
    "customerNumber": "CLI-005256",
    "abnetNumber": "6568"
  },
  {
    "customerId": "7b5c1697-fc8b-49b1-b7f9-c9c283d37ae7",
    "customerNumber": "CLI-005255",
    "abnetNumber": "6567"
  },
  {
    "customerId": "6211363d-434b-41a8-ab86-4667bcdcd7d8",
    "customerNumber": "CLI-005254",
    "abnetNumber": "6566"
  },
  {
    "customerId": "5e0a8a00-fc08-4e99-8164-d909c81001a1",
    "customerNumber": "CLI-005252",
    "abnetNumber": "6565"
  },
  {
    "customerId": "89e8af4d-ea42-44ac-8529-1aaa04bc355e",
    "customerNumber": "CLI-005251",
    "abnetNumber": "6564"
  },
  {
    "customerId": "ec2e6b11-56d8-4bb8-97c7-5c3ae3b6d7a6",
    "customerNumber": "CLI-005249",
    "abnetNumber": "6563"
  },
  {
    "customerId": "5326ae2c-ecf6-46f0-a2b7-88043b8bac39",
    "customerNumber": "CLI-005240",
    "abnetNumber": "6560"
  },
  {
    "customerId": "d801da61-842d-4770-a918-57a563da5f0f",
    "customerNumber": "CLI-005239",
    "abnetNumber": "6559"
  },
  {
    "customerId": "52e531ec-448c-4560-a33c-45720511928e",
    "customerNumber": "CLI-005472",
    "abnetNumber": "6551"
  },
  {
    "customerId": "1f5759a4-9229-4ed9-9444-0140fe38f8f5",
    "customerNumber": "CLI-005497",
    "abnetNumber": "6548"
  },
  {
    "customerId": "15e85357-13a0-42df-924c-491aa02c5232",
    "customerNumber": "CLI-005257",
    "abnetNumber": "6543"
  },
  {
    "customerId": "fb09cf08-09c6-4e67-8c03-15157d11b0a7",
    "customerNumber": "CLI-005246",
    "abnetNumber": "6542"
  },
  {
    "customerId": "7f295877-02d7-4c2b-86ea-33918b8a65d2",
    "customerNumber": "CLI-005304",
    "abnetNumber": "6535"
  }
]

export const EXCLUDED_CUSTOMER_IDS = [
  "7074bed5-eefb-426c-b456-046d4aec4604",
  "c226898a-d36f-45f3-ae76-201a448186a2",
  "679a0f60-a363-46fe-9843-9bb7ca4d0ecb",
  "a8afd507-9280-4254-a180-fb53cdd1cdce",
  "dc2a0cfd-c885-4ed5-b67d-1a2ad5279c97",
  "c43b7416-d4e3-4dca-9f7a-b6eef24e0841",
  "8a3e9544-a48c-4c52-b01b-ac1e735a68b0",
  "5307d916-2373-476a-a3e6-1c6fee8a6c55",
  "0b52a9c2-5dba-4ab2-9171-38b32e2c914d",
  "d289a795-54cf-4388-aa3c-8fd9faa8a079",
  "7eddd7dd-e4ee-4eba-9791-521c26bd1342",
  "67bfc33a-a46b-4237-8ad5-c10775745f10",
  "836cfa4f-1ddb-4c13-b7bf-b5b2cba23d9d",
  "6835063f-21f1-4d4a-a629-8fab8cc9512c",
  "ec3ed362-be8a-4269-97a4-28fc56f67151",
  "5ae8ae66-36d1-48d3-9a46-8ef1ded5551e",
  "881b6b22-9897-403f-9a8c-7a46c5ab5742",
  "1cac8b99-e8b4-4bb2-899d-df0846ec2b0e",
  "48fd4dbd-a66b-4b9c-822c-08787f1d61b7",
  "18662feb-df18-49e7-b5fc-1d89c171d381",
  "78804a0e-da0e-4efb-9120-9d0c28d0c29f",
  "1f25b634-5272-4c55-a5f2-eb75fe6dc487",
  "10a9b027-cfe0-4be4-8063-6c7f804e6d55",
  "6355995d-eec2-4728-8aa8-f529cb9ec29d",
  "a287860c-a5a5-4277-ad51-4058369029d7",
  "8fc00fe3-9479-4da5-817c-8c1d46df6e77",
  "c874341e-a0ff-4c7a-ad04-26a65fbfca74",
  "2c623048-dd8d-46f7-bd6a-032bb27eb901",
  "e3aaa087-bc03-4061-8e26-077d0066afec",
  "ae5390e4-dfa4-43f2-9920-78d21952c686",
  "55497ace-5e31-46d2-af6d-602783a4776b",
  "570270f9-1756-429e-b474-a4167972a56b",
  "6086482c-a064-439e-9fa9-e2251e73bd36",
  "f4fc5ff9-049d-4f53-a3f5-69a04022ef6d",
  "79feb035-f7ef-4df7-864b-6ab92ffd8128",
  "1b7e53d8-8ef1-4b57-9d42-790647e71698",
  "eeba87ad-a8b3-4437-abd3-6c4ee23cda44",
  "8e872c0c-99c1-4467-81e7-de059fa4e3dc",
  "e8cdb602-e077-4e33-b3f5-29a7164ecb72",
  "5dfe1eec-417c-448c-8b64-4fed9ef12264",
  "0ae7a67a-7a51-4b1d-82bb-42a931459a3a",
  "163b75e9-cdfa-4d64-bebe-26b07291c4db",
  "2157688e-9822-4daf-937b-4cdce653c6bc",
  "7580d749-4fbc-42d1-baaf-c5f8bb0300e3",
  "e7bddca2-bea9-4373-9eee-9511aaa274d1",
  "c2d34d3a-d145-456b-b70f-cd73aecff0a3",
  "6400866a-a1d6-46d9-b32a-173e35133e3c",
  "f47ab6eb-6cd3-4f25-a41d-cfb2a66fb3bd",
  "3f30e67b-7c1b-4a78-ab51-70e51406a883",
  "524b4b7b-aa40-4701-9ddd-8c216c5fd401",
  "a2fe6cd8-8dbf-41d7-bcd6-ec24b30d995f",
  "fc9b50b6-cbb1-4088-bd50-161fcf38e304",
  "5222aff0-abf9-48d2-aa21-161d15e7d1f9",
  "abb6c045-0336-4e93-96d1-5a6e03f95f88",
  "7f416492-b51b-4163-9304-d04cec3af68d",
  "7fb0160c-e2bc-4316-ae3e-1bb0b8a269e7",
  "8394dde4-3408-476f-a17a-c36d557fab2e",
  "9a26983b-be45-42ed-9966-1b8d2fc4d3fa",
  "07a5a323-fac5-419d-aa6a-7f5af62d4592",
  "29eef592-a46b-4c56-8724-4ed73cdaed0e",
  "7539d8fd-b01e-402b-ad88-502d5acac024",
  "952aa87a-50ff-466b-b28e-1f353c6014b7",
  "8469ed69-7ce8-45e8-902a-da332a4617df",
  "89f462ed-73b3-4c90-b7f1-ab3736a172f2",
  "90ad621f-53f9-4fba-8c80-932e7df0f00e",
  "ed189adb-ac71-4916-8d58-24a7bbf184ac",
  "94ba7049-0407-4b64-a37f-fc9dd046c9d5",
  "c7310950-2563-474a-ae13-684ef017786f",
  "950fd182-0020-49a4-a93c-2bc0b2932296",
  "abc4c939-aa6c-4d77-8824-7f71e914e450",
  "cf7ddd07-474d-4e0d-add8-b2d0489a36e5",
  "e2f08fa8-87dc-4404-8162-1095864782db",
  "1797819e-d1af-4c41-a060-cc3343456f8b",
  "43595bc8-748f-420f-bc31-b038dce30109",
  "bcee907c-87a0-4238-8c06-bdb9202a6043",
  "04641e20-e6eb-4c45-97f7-503210cd9d9b",
  "1919da4b-8ade-4a29-89d3-750e028df0de",
  "5406b38e-e2db-457a-b372-7f6cff6b5c85",
  "a25d120e-b638-4911-b176-74df35ae4d4f",
  "a3af3bea-965b-4541-8eec-fe4b6506eaee",
  "cfab4975-9a29-4fb6-8081-ab1bc0370585",
  "3ca8be68-dc8e-4fad-864a-64d78c9082a4",
  "8e40cfc0-7a30-4bd3-8e89-93feefa2f582",
  "e0e721be-799d-42fc-9c70-e1e04ff53d03",
  "f3029796-4a9b-44d0-8ed1-c88447803a3d",
  "c8c48e37-8aa7-4c1f-b89b-1257f9788bf2",
  "cd72227c-66aa-41bb-a96c-4504ac8a2be4",
  "3d28603c-55fe-4bc1-b297-3acf84e3147f",
  "5c19a08c-6a88-46de-bef9-758aad763b30",
  "1b41d9a3-db7b-43b3-9862-8a402827305f",
  "4eaf8bdf-d52c-4e24-a095-ac6bda2f678f",
  "50548384-9e4b-45b5-9509-f06e056d0c22",
  "5b12473d-62fa-438a-9fde-8d79422a9ff9",
  "5d7256d0-09ba-4975-b473-5f335d1d2772",
  "66019d0a-92a3-46f4-93a2-675280f4631b",
  "bda0beec-d58f-4a88-9bbf-589e23c3aa5b",
  "cd096804-2fc5-46b8-99ef-b96841468d4f",
  "faaaf359-1f7f-4dce-9b6c-165af9a892d7",
  "6dac27e6-07e2-4e78-a974-e9f323c91292",
  "97e20620-e4be-4bf1-9b18-28bb0566522e",
  "2c93cc8d-eceb-4b8d-85d2-6d2246e538f9",
  "f0904b26-7dd1-42d3-963c-deb6b25d913f",
  "18f1ca1a-7698-4ed0-ae2b-8dccbfc13ff1",
  "571868b2-062c-43ba-be30-bb9f2014360d",
  "6719cad9-f42d-4a7a-babe-dae8463f6866",
  "7800f2d3-beb7-41ba-b093-34569b73e6dd",
  "a3de379d-5d31-4b29-bc24-43e457cd7d72",
  "b08647d3-d85c-4940-adf5-433d240dafec",
  "a80a6513-31ce-456f-9144-5f1702add065",
  "f6043590-78dc-4d39-be44-8a0ed6ed008f",
  "05530bb4-cb11-4343-8cd4-edfc04ec5d7e",
  "0c00a90c-19b0-460a-9db5-8b413933141f",
  "3d1cae54-3f79-4d1e-8d97-b3778683f4cf",
  "4327059f-7f6d-4eef-811c-889c53a64dff",
  "476c1f1b-e2ae-4a51-8a65-53e46d41b5e6",
  "6083b5fb-c742-4624-a910-f8dc4d7d4768",
  "1a723293-bf52-43ac-a271-048369cd3909",
  "51a08386-f128-42d4-ac7a-6d22e1944c5c",
  "839f04e9-f208-4941-bec6-3e332df271db",
  "a83aadc2-c46a-413b-ae3d-5cbecea41b69",
  "b84d1905-e590-451b-97b7-94aeeff2ba66",
  "d0a37eeb-bf8e-442d-914d-ff3dd6fb8d09",
  "bd12680b-c5a8-417d-ae40-3fdc6b907a60",
  "c1db6358-b25e-43d7-8f54-f50de8d8efc9"
]

export const EXCLUDED_ABNET_NUMBERS = [
  "3329",
  "3440",
  "6530",
  "6553",
  "6558",
  "6561",
  "6562",
  "6569",
  "6570",
  "6573",
  "6574",
  "6576",
  "6582",
  "6590",
  "6596",
  "6600",
  "6602",
  "6604",
  "6605",
  "6610",
  "6611",
  "6613",
  "6615",
  "6616",
  "6621",
  "6628",
  "6632",
  "6635",
  "6639",
  "6641",
  "6645",
  "6653",
  "6654",
  "6655",
  "6656",
  "6658",
  "6659",
  "6661",
  "6667",
  "6668",
  "6672",
  "6673",
  "6674",
  "6676",
  "6682",
  "6685",
  "6687",
  "6688",
  "6692",
  "6693",
  "6701",
  "6703",
  "6705",
  "6707",
  "6709",
  "6710",
  "6728",
  "6729",
  "6731",
  "6734",
  "6735",
  "6736",
  "6737",
  "6740",
  "6744",
  "6745",
  "6751",
  "6752",
  "6756",
  "6760",
  "6785",
  "6791",
  "6794",
  "6796",
  "6797"
]

export const PREEXISTING_DUPLICATE_ABNET_NUMBERS = ["1390", "1708", "3029", "3058", "4676", "5032", "5437"]

export const APPROVED_MINOR_NAME_NUMBERS = ["6535", "6623", "6646", "6657", "6663", "6727", "6770", "6774", "6786", "6789", "6795"]

const DUPLICATE_AUDIT_NUMBER = "6742"
const DUPLICATE_AUDIT_CUSTOMER = "CLI-005665"

export function assertApprovedIdentityList(auditRows = APPROVED_AUDIT_ROWS) {
  if (auditRows.length !== 164) throw new Error("La lista aprobada debe tener 164 filas de auditoría.")
  const byCustomer = new Map()
  const numbers = new Set()
  const excludedCustomers = new Set(EXCLUDED_CUSTOMER_IDS)
  let duplicateRows = 0
  for (const row of auditRows) {
    if (!/^[0-9a-f-]{36}$/i.test(row.customerId)) throw new Error("customer_id inválido.")
    if (!/^CLI-\d{6}$/.test(row.customerNumber)) throw new Error("customer_number inválido.")
    if (!/^\d+$/.test(row.abnetNumber) || row.abnetNumber === "0") throw new Error("N° ABNet inválido.")
    if (EXCLUDED_ABNET_NUMBERS.includes(row.abnetNumber)) {
      throw new Error("La lista incluye un N° ABNet excluido: " + row.abnetNumber)
    }
    if (PREEXISTING_DUPLICATE_ABNET_NUMBERS.includes(row.abnetNumber)) {
      throw new Error("La lista incluye un N° ABNet ya duplicado: " + row.abnetNumber)
    }
    if (excludedCustomers.has(row.customerId)) {
      throw new Error("La lista incluye un customer excluido.")
    }
    numbers.add(row.abnetNumber)
    const current = byCustomer.get(row.customerId)
    if (current) {
      duplicateRows += 1
      if (
        current.abnetNumber !== row.abnetNumber
        || current.customerNumber !== row.customerNumber
        || row.abnetNumber !== DUPLICATE_AUDIT_NUMBER
        || row.customerNumber !== DUPLICATE_AUDIT_CUSTOMER
      ) {
        throw new Error("Hay un customer repetido que no es 6742 / CLI-005665.")
      }
    } else {
      byCustomer.set(row.customerId, row)
    }
  }
  if (duplicateRows !== 1 || byCustomer.size !== 163 || numbers.size !== 163) {
    throw new Error("La lista debe colapsar 164 filas en 163 customers y 163 números.")
  }
  for (const number of APPROVED_MINOR_NAME_NUMBERS) {
    if (!numbers.has(number)) throw new Error("Falta un caso de nombre mínimo aprobado: " + number)
  }
  return [...byCustomer.values()]
}

export function uniqueApprovedAssignments(auditRows = APPROVED_AUDIT_ROWS) {
  return assertApprovedIdentityList(auditRows)
}

function blank(value) {
  return value == null || String(value).trim() === ""
}

export function decideApprovedIdentityAssignment(assignment, input) {
  const customer = input.customer
  const excluded = input.excludedCustomerIds ?? EXCLUDED_CUSTOMER_IDS
  if (!customer || customer.deleted_at) {
    return { action: "SKIPPED_REVALIDATION", reason: "El customer ya no está disponible." }
  }
  if (customer.id !== assignment.customerId || customer.customer_number !== assignment.customerNumber) {
    return { action: "SKIPPED_REVALIDATION", reason: "El customer aprobado no coincide." }
  }
  if (excluded.includes(customer.id)) {
    return { action: "SKIPPED_REVALIDATION", reason: "El customer pertenece a un grupo excluido." }
  }
  if (!APPROVED_AUDIT_ROWS.some((row) => row.customerId === assignment.customerId && row.abnetNumber === assignment.abnetNumber && row.customerNumber === assignment.customerNumber)) {
    return { action: "SKIPPED_REVALIDATION", reason: "La asignación no está en la lista aprobada." }
  }
  const current = abnetNumberFromExternalCode(customer.external_customer_code)
  if (current === assignment.abnetNumber) {
    return { action: "SKIPPED_ALREADY_ASSIGNED", reason: "El N° ABNet ya está asignado a este customer." }
  }
  if (current || !blank(customer.external_customer_code)) {
    return { action: "SKIPPED_REVALIDATION", reason: "El customer ya tiene otro N° ABNet." }
  }
  if ((input.customersWithSameNumber ?? 0) > 0) {
    return { action: "SKIPPED_REVALIDATION", reason: "El N° ABNet ya está asignado a otro customer." }
  }
  return { action: "UPDATED" }
}

function guardedFrom(client, approvedCodes) {
  return (table) => {
    const builder = client.from(table)
    return new Proxy(builder, {
      get(target, prop, receiver) {
        if (prop === "insert" || prop === "delete" || prop === "upsert") {
          return () => {
            throw new Error(String(prop) + " está bloqueado.")
          }
        }
        if (prop === "update") {
          return (values) => {
            const keys = Object.keys(values ?? {})
            if (table !== "customers" || keys.length !== 1 || keys[0] !== "external_customer_code") {
              throw new Error("Solo se puede asignar external_customer_code en customers.")
            }
            if (!approvedCodes.has(values.external_customer_code)) {
              throw new Error("El N° ABNet no está en la lista aprobada.")
            }
            return target.update(values)
          }
        }
        const value = Reflect.get(target, prop, receiver)
        return typeof value === "function" ? value.bind(target) : value
      },
    })
  }
}

function fingerprint(rows, pick) {
  return rows
    .filter((row) => !row.deleted_at)
    .map(pick)
    .sort()
    .join("\n")
}

function duplicateNumbers(rows) {
  const counts = new Map()
  for (const row of rows) {
    if (row.deleted_at) continue
    const number = abnetNumberFromExternalCode(row.external_customer_code)
    if (!number) continue
    counts.set(number, (counts.get(number) ?? 0) + 1)
  }
  return [...counts.entries()]
    .filter((entry) => entry[1] > 1)
    .map((entry) => entry[0])
    .sort()
}

async function assignEmptyCode(db, assignment) {
  const code = padAbnetExternalCode(assignment.abnetNumber)
  const { data, error } = await db
    .from("customers")
    .update({ external_customer_code: code })
    .eq("id", assignment.customerId)
    .eq("customer_number", assignment.customerNumber)
    .eq("company_id", ABNET_COMPANY_ID)
    .is("external_customer_code", null)
    .select("id")
  if (error) throw new Error(error.message)
  return (data ?? []).length === 1
}

async function main() {
  const assignments = uniqueApprovedAssignments()
  const approvedCodes = new Set(assignments.map((row) => padAbnetExternalCode(row.abnetNumber)))
  const { url, key } = loadEnv()
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const db = { from: guardedFrom(client, approvedCodes) }
  const customerColumns = "id, customer_number, name, dni, email, phone, address, locality, status, external_customer_code, deleted_at, updated_at"
  const beforeCustomers = await fetchAll(db, "customers", customerColumns)
  const beforeServices = await fetchAll(db, "isp_services", "id, updated_at")
  const beforeConnections = await fetchAll(db, "isp_connections", "id, updated_at")
  const beforeTasks = await fetchAll(db, "tasks", "id, updated_at")
  const liveBefore = beforeCustomers.filter((row) => !row.deleted_at)
  const byId = new Map(liveBefore.map((row) => [row.id, row]))
  const countByNumber = new Map()
  for (const row of liveBefore) {
    const number = abnetNumberFromExternalCode(row.external_customer_code)
    if (!number) continue
    countByNumber.set(number, (countByNumber.get(number) ?? 0) + 1)
  }
  const withoutBefore = liveBefore.filter((row) => !abnetNumberFromExternalCode(row.external_customer_code)).length

  const results = []
  let updated = 0
  let skippedAlreadyAssigned = 0
  let skippedRevalidation = 0
  for (const row of APPROVED_AUDIT_ROWS) {
    const customer = byId.get(row.customerId) ?? null
    const decision = decideApprovedIdentityAssignment(row, {
      customer,
      customersWithSameNumber: countByNumber.get(row.abnetNumber) ?? 0,
    })
    if (decision.action === "UPDATED") {
      const wrote = await assignEmptyCode(db, row)
      if (!wrote) {
        skippedRevalidation += 1
        results.push({
          customerNumber: row.customerNumber,
          customerId: row.customerId,
          abnetNumber: row.abnetNumber,
          before: null,
          after: null,
          result: "SKIPPED_REVALIDATION",
          reason: "El campo dejó de estar vacío antes del UPDATE.",
        })
        continue
      }
      customer.external_customer_code = padAbnetExternalCode(row.abnetNumber)
      countByNumber.set(row.abnetNumber, (countByNumber.get(row.abnetNumber) ?? 0) + 1)
      updated += 1
      results.push({
        customerNumber: row.customerNumber,
        customerId: row.customerId,
        abnetNumber: row.abnetNumber,
        before: null,
        after: row.abnetNumber,
        result: "UPDATED",
      })
      continue
    }
    if (decision.action === "SKIPPED_ALREADY_ASSIGNED") skippedAlreadyAssigned += 1
    else skippedRevalidation += 1
    results.push({
      customerNumber: row.customerNumber,
      customerId: row.customerId,
      abnetNumber: row.abnetNumber,
      before: abnetNumberFromExternalCode(customer?.external_customer_code) ,
      after: decision.action === "SKIPPED_ALREADY_ASSIGNED" ? row.abnetNumber : abnetNumberFromExternalCode(customer?.external_customer_code),
      result: decision.action,
      reason: decision.reason,
    })
  }

  const afterCustomers = await fetchAll(db, "customers", customerColumns)
  const afterServices = await fetchAll(db, "isp_services", "id, updated_at")
  const afterConnections = await fetchAll(db, "isp_connections", "id, updated_at")
  const afterTasks = await fetchAll(db, "tasks", "id, updated_at")
  const liveAfter = afterCustomers.filter((row) => !row.deleted_at)
  const afterById = new Map(liveAfter.map((row) => [row.id, row]))
  const approvedIds = new Set(assignments.map((row) => row.customerId))
  const identity = (row) => [row.id, row.customer_number, row.name, row.dni, row.email, row.phone, row.address, row.locality, row.status].join("|")
  const outsideCode = (row) => approvedIds.has(row.id) ? null : row.id + "|" + (row.external_customer_code ?? "")
  const maxUpdated = (items) => items.reduce((max, row) => ((row.updated_at ?? "") > max ? row.updated_at : max), "")
  const beforeDuplicates = duplicateNumbers(beforeCustomers)
  const afterDuplicates = duplicateNumbers(afterCustomers)
  const holders6742 = liveAfter.filter((row) => abnetNumberFromExternalCode(row.external_customer_code) === "6742")
  const linked = assignments.every((row) => abnetNumberFromExternalCode(afterById.get(row.customerId)?.external_customer_code) === row.abnetNumber)
  const withoutAfter = liveAfter.filter((row) => !abnetNumberFromExternalCode(row.external_customer_code)).length
  const unchanged = {
    customerCount: liveBefore.length === 5835 && liveAfter.length === 5835,
    customerIds: fingerprint(beforeCustomers, (row) => row.id) === fingerprint(afterCustomers, (row) => row.id),
    identity: fingerprint(beforeCustomers, identity) === fingerprint(afterCustomers, identity),
    outsideCodes: fingerprint(beforeCustomers, outsideCode) === fingerprint(afterCustomers, outsideCode),
    services: beforeServices.length === 3998 && afterServices.length === 3998 && maxUpdated(beforeServices) === maxUpdated(afterServices),
    connections: beforeConnections.length === 3998 && afterConnections.length === 3998 && maxUpdated(beforeConnections) === maxUpdated(afterConnections),
    tasks: beforeTasks.length === 1427 && afterTasks.length === 1427 && maxUpdated(beforeTasks) === maxUpdated(afterTasks),
    duplicates: beforeDuplicates.join(",") === PREEXISTING_DUPLICATE_ABNET_NUMBERS.join(",") && afterDuplicates.join(",") === PREEXISTING_DUPLICATE_ABNET_NUMBERS.join(","),
    withoutNumber: withoutAfter === withoutBefore - updated,
    number6742: holders6742.length === 1 && holders6742[0].customer_number === "CLI-005665",
    linked,
  }
  const ok = Object.values(unchanged).every(Boolean)
    && skippedRevalidation === 0
    && updated + skippedAlreadyAssigned === 164
    && results.length === 164
  const report = {
    approvedAuditRows: 164,
    approvedCustomers: 163,
    updated,
    skippedAlreadyAssigned,
    skippedRevalidation,
    number6742: {
      customerNumber: "CLI-005665",
      holders: holders6742.map((row) => row.customer_number),
    },
    minorNameNumbersIncluded: APPROVED_MINOR_NAME_NUMBERS.every((number) => assignments.some((row) => row.abnetNumber === number)),
    unchanged,
    counts: {
      customers: liveAfter.length,
      services: afterServices.length,
      connections: afterConnections.length,
      tasks: afterTasks.length,
      withoutAbnetNumber: withoutAfter,
    },
    assignments: results,
  }
  console.log(JSON.stringify(report, null, 2))
  if (!ok) process.exit(1)
}

const isDirectRun = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false

if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
