const express = require("express");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;
app.use(express.json());

const intializeDbandServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Server running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DataBase Error ${e.message}`);
    process.exit(1);
  }
};

intializeDbandServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "manicharan", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login/",async (request,response)=>{
    const {username,password} = request.body;
    const selectUserQuery =`SELECT * FROM user WHERE username = '${username}';`
    const dbUser = await db.get(selectUserQuery);
    if (dbUser === undefined) {
        response.status(400);
        response.send("Invalid user");
    }
    else{
        const isPasswordMatch = await bcrypt.compare(password,dbUser.password);
        if (isPasswordMatch) {
            const payload={
                username:username
            };
            let jwtToken = jwt.sign(payload,"manicharan");
            response.send({jwtToken:jwtToken});
        } else {
            response.status(400);
            response.send("Invalid password");
        }
    }
});


const convertDbObjectToResponseObject1 = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};
app.get("/states/",authenticateToken, async (request, response) => {
  const stateQuery = `
    SELECT 
    *
    FROM 
    state
    ORDER BY 
    state_id;
    `;
  const stateArray = await db.all(stateQuery);
  response.send(
    stateArray.map((eachState) => convertDbObjectToResponseObject1(eachState))
  );
});

app.get("/states/:stateId/",authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const stateQuery = `
    SELECT 
    *
    FROM 
    state
    WHERE 
    state_id = ${stateId};
    `;
  const stateArray = await db.get(stateQuery);
  response.send(convertDbObjectToResponseObject1(stateArray));
});

app.post("/districts/",authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;

  const addDistrictQuery = `
    INSERT INTO 
    district (district_name,state_id,cases,cured,active,deaths)
    VALUES(
        '${districtName}',
        ${stateId},
        ${cases},
        ${cured},
        ${active},
        ${deaths}
    );
    `;
  await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

const convertDbObjectToResponseObject2 = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};
app.get("/districts/:districtId/",authenticateToken, async (request, response) => {
  const { districtId } = request.params;
  const districtQuery = `
    SELECT 
    *
    FROM 
    district
    WHERE
    district_id = ${districtId};
    `;
  const districtArray = await db.get(districtQuery);
  response.send(convertDbObjectToResponseObject2(districtArray));
});

app.delete("/districts/:districtId/",authenticateToken, async (request, response) => {
  const { districtId } = request.params;
  const deleteQuery = `
    DELETE FROM
    district 
    WHERE
    district_id=${districtId};
    `;
  await db.run(deleteQuery);
  response.send("District Removed");
});

app.put("/districts/:districtId/",authenticateToken, async (request, response) => {
  const { districtId } = request.params;
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;

  const updateDistrictQuery = `
    UPDATE
    district
    SET 
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
    WHERE
    district_id = ${districtId};
    `;
  await db.run(updateDistrictQuery);
  response.send("District Details Updated");
});

app.get("/states/:stateId/stats/",authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateStatsQuery = `
    SELECT 
    SUM(cases),
    SUM(cured),
    SUM(active),
    SUM(deaths)
    FROM 
    district 
    WHERE
    state_id = ${stateId};
    `;
  const stats = await db.get(getStateStatsQuery);
  console.log(stats);
  response.send({
    totalCases: stats["SUM(cases)"],
    totalCured: stats["SUM(cured)"],
    totalActive: stats["SUM(active)"],
    totalDeaths: stats["SUM(deaths)"],
  });
});

module.exports = app;
