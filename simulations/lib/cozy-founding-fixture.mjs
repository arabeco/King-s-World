import {readFile} from "node:fs/promises";
import {createCozyDatabase} from "./cozy-fixture.mjs";
import {loadCozyEngine} from "./load-cozy-engine.mjs";

export async function createCozyFoundingDatabase({persistent,repeatMigrations=false}) {
  const db=await createCozyDatabase();
  try {
    await db.exec("create schema auth; create function auth.uid() returns uuid language sql as $$select null::uuid$$;");
    const migrations=[
      "11_SQL_PREMIUM_ENTITLEMENTS_PLAYSTORE.sql", "63_SQL_COZY_EXPRESS_ECONOMY.sql",
      "65_SQL_COZY_LOBBY.sql", "66_SQL_ROYAL_ATTRIBUTES.sql", "67_SQL_ACCOUNT_APPEARANCE.sql",
      "68_SQL_COLLECTION_WALLET.sql", "69_SQL_KING_GAMEPLAY_PROGRESSION.sql",
      "70_SQL_COLLECTION_SEASON_REWARDS.sql", "71_SQL_COZY_PREMIUM_BENEFITS.sql",
      "73_SQL_SEASON_POSITION_REWARDS.sql", "74_SQL_COMPETITIVE_WORLD_MODE.sql",
      "75_SQL_PLAY_GEM_PURCHASES.sql", "76_SQL_COZY_UNIFIED_RHYTHM.sql",
      "77_SQL_COZY_FOUNDING_ONBOARDING.sql",
      ...(persistent ? ["78_SQL_COZY_PERSISTENT_WORLD.sql", "79_SQL_COZY_ASCENSION_ARCHIVE.sql",
        "80_SQL_COZY_ASCENSION_REENTRY.sql", "81_SQL_COZY_ASCENSION_RITE.sql"] : []),
    ];
    for(const name of migrations){
      const sql=await readFile(new URL(`../../${name}`,import.meta.url),"utf8");
      await db.exec(sql);
      if(repeatMigrations&&/^(77|79|80)_/.test(name))await db.exec(sql);
    }
    return db;
  } catch(error){
    await db.close();
    throw error;
  }
}

export async function stageCozyAscension(db,state) {
  const city=state.cities[0];
  city.life.contentment=75;
  city.integrity=84;
  for(const sector of Object.keys(city.sectors))city.sectors[sector]=10;
  for(const research of Object.keys(state.research))state.research[research]=5;
  for(let index=1;index<10;index++)state.heroes.push({id:`fixture-hero-${index}`,name:`Guardião ${index}`,role:"general",cityId:null});
  state.army.militia=40000;
  state.progression.council.merit=500;
  state.quests=loadCozyEngine("catalog").QUESTS.map(quest=>quest.id);
  state.peakInfluence=2200;
  state.resources={gold:1000,materials:6000,supplies:4000};
  delete state.firstAudience;
  await db.query("update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2",
    [JSON.stringify(state),state.playerId]);
}
