const express = require('express')
const app = express()

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')

const path = require('path')
const dbpath = path.join(__dirname, 'covid19IndiaPortal.db')

const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
let db = null

//Intailization of DB and server
const intailizationOfDBAndServer = async (request, response) => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running is Started at localhost:3000')
    })
  } catch (e) {
    console.log(`DB Error '${e.message}'`)
    process.exit(1)
  }
}
intailizationOfDBAndServer()
app.use(express.json())

///API1
/// Authentication Token
const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const user = `SELECT * FROM  user WHERE username = '${username}'`
  const res = await db.get(user)
  if (res === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordRight = await bcrypt.compare(password, res.password)
    if (isPasswordRight === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken: jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//API 2
app.get('/states/', authenticateToken, async (request, response) => {
  const getQuery = `
    SELECT *
    FROM state;
    `
  const result = await db.all(getQuery)
  const ans = result => {
    return {
      stateId: result.state_id,
      stateName: result.state_name,
      population: result.population,
    }
  }
  response.send(result.map(each => ans(each)))
})

//API3
app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getQuery = `
    SELECT *
    FROM state 
    WHERE state_id = '${stateId}';
    `
  const state = await db.get(getQuery)
  response.send({
    stateId: state.state_id,
    stateName: state.state_name,
    population: state.population,
  })
})

//API4
app.post('/districts/', authenticateToken, async (request, response) => {
  let bodyDtails = request.body
  const {districtName, stateId, cases, cured, active, deaths} = bodyDtails
  const getQuery = `
    INSERT INTO district (district_name, state_id, cases, cured , active, deaths)
    VALUES (
        '${districtName}',
        '${stateId}',
        '${cases}',
        '${cured}',
        '${active}',
        '${deaths}'
    );
    `
  await db.run(getQuery)
  response.send('District Successfully Added')
})
//// API 5
app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    let {districtId} = request.params
    const getQuery = `
    SELECT *
    FROM district
    WHERE district_id = '${districtId}';
    `
    const district = await db.get(getQuery)
    response.send({
      districtId: district.district_id,
      districtName: district.district_name,
      stateId: district.state_id,
      cases: district.cases,
      cured: district.cured,
      active: district.active,
      deaths: district.deaths,
    })
  },
)

//API6
app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getQuery = `
    DELETE FROM 
      district
    WHERE 
      district_id  = '${districtId}';
    `
    await db.run(getQuery)
    response.send('District Removed')
  },
)

//API7
app.put(
  ' /districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const bodyDtails = request.body
    const {districtName, stateId, cases, cured, active, deaths} = bodyDtails
    const getQuery = `
    UPDATE 
      district
    SET 
      district_name = '${districtName}',
      state_id = '${stateId}',
      cases = '${cases}',
      cured ='${cured}',
      active = '${active}',
      deaths = '${deaths}'
    WHERE 
      district_id = '${districtId}'; 
    `
    await db.run(getQuery)
    response.send('District Details Updated')
  },
)

//API8
app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const getQuery = `
    SELECT 
    SUM(cases) as totalCases,
    SUM(cured) as totalCured,
    SUM(active) as totalActive,
    SUM(deaths) as totalDeaths
    FROM district
    WHERE state_id = '${stateId}';
    `
    const result = await db.get(getQuery)
    response.send(result)
  },
)
module.exports = app
