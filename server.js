
require("dotenv").config();

const express = require("express");
const axios = require("axios");
const { Pool } = require("pg");
const XLSX = require("xlsx");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;


// ==================================================
// DATABASE
// ==================================================

if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is missing.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});


// ==================================================
// ERPLY CONFIGURATION
// ==================================================

if (
    !process.env.CLIENT_CODE ||
    !process.env.ERPLY_USERNAME ||
    !process.env.PASSWORD
) {
    console.error(
        "ERPLY configuration is missing. Please check CLIENT_CODE, USERNAME and PASSWORD."
    );

    process.exit(1);
}

const ERPLY_URL =
    process.env.ERPLY_URL ||
    `https://${process.env.CLIENT_CODE}.erply.com/api/`;


// ==================================================
// ERPLY SESSION
// ==================================================

let erplySessionKey = null;
let erplySessionExpiry = 0;


// ==================================================
// ERPLY LOGIN
// ==================================================

async function verifyUser() {

    try {

        console.log("Logging into ERPLY...");

        const params = new URLSearchParams();

        params.append(
            "request",
            "verifyUser"
        );

        params.append(
            "clientCode",
            process.env.CLIENT_CODE
        );

        params.append(
            "username",
            process.env.ERPLY_USERNAME
        );

        params.append(
            "password",
            process.env.PASSWORD
        );

        params.append(
            "sendContentType",
            "1"
        );


        const response = await axios.post(
            ERPLY_URL,
            params.toString(),
            {
                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded"
                }
            }
        );


        const data = response.data;


        if (
            !data ||
            !data.status ||
            data.status.errorCode !== 0
        ) {

            console.error(
                "ERPLY login failed:",
                data?.status
            );

            throw new Error(
                data?.status?.errorMessage ||
                "ERPLY authentication failed."
            );

        }


        // ------------------------------------------
        // Get session key
        // ------------------------------------------

        const sessionKey =
            data.records?.[0]?.sessionKey ||
            data.status?.sessionKey;


        if (!sessionKey) {

            throw new Error(
                "ERPLY login succeeded but no session key was returned."
            );

        }


        erplySessionKey = sessionKey;


        // Keep session for 55 minutes
        erplySessionExpiry =
            Date.now() + (55 * 60 * 1000);


        console.log(
            "ERPLY authentication successful."
        );


        return erplySessionKey;

    } catch (error) {

        console.error(
            "ERPLY authentication error:",
            error.response?.data ||
            error.message
        );

        throw error;
    }
}


// ==================================================
// GET VALID ERPLY SESSION
// ==================================================

async function getErplySession() {

    if (
        erplySessionKey &&
        Date.now() < erplySessionExpiry
    ) {

        return erplySessionKey;

    }


    return await verifyUser();
}


// ==================================================
// ERPLY API REQUEST
// ==================================================

async function erplyRequest(params) {

    let sessionKey =
        await getErplySession();


    async function makeRequest() {

        const requestParams = new URLSearchParams();


        requestParams.append(
            "clientCode",
            process.env.CLIENT_CODE
        );

        requestParams.append(
            "sessionKey",
            sessionKey
        );


        for (const [key, value] of Object.entries(params)) {

            if (
                value !== undefined &&
                value !== null
            ) {

                requestParams.append(
                    key,
                    String(value)
                );

            }

        }


        requestParams.append(
            "sendContentType",
            "1"
        );


        const response = await axios.post(
            ERPLY_URL,
            requestParams.toString(),
            {
                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded"
                }
            }
        );


        return response.data;
    }


    let data;


    try {

        data = await makeRequest();

    } catch (error) {

        console.error(
            "ERPLY request error:",
            error.response?.data ||
            error.message
        );

        throw error;
    }


    // ------------------------------------------
    // Session expired
    // ------------------------------------------

    if (
        data?.status?.errorCode === 1054 ||
        data?.status?.errorCode === 1055
    ) {

        console.log(
            "ERPLY session expired. Logging in again..."
        );


        erplySessionKey = null;
        erplySessionExpiry = 0;


        sessionKey =
            await verifyUser();


        data = await makeRequest();

    }


    if (
        !data ||
        !data.status ||
        data.status.errorCode !== 0
    ) {

        throw new Error(
            data?.status?.errorMessage ||
            `ERPLY API error: ${
                data?.status?.errorCode || "Unknown error"
            }`
        );

    }


    return data;
}


// ==================================================
// GET ERPLY TRANSACTION COUNT
// ==================================================

async function getErplyTransactionCount(date) {

    let pageNo = 1;
    const recordsOnPage = 100;

    let totalTransactions = 0;


    while (true) {

        const data = await erplyRequest({

            request:
                "getSalesDocuments",

            dateFrom:
                date,

            dateTo:
                date,

            warehouseID:
                1,

            confirmed:
                1,

            types:
                "INVWAYBILL,CASHINVOICE,CREDITINVOICE,INVOICE",

            pageNo:
                pageNo,

            recordsOnPage:
                recordsOnPage

        });


        const records =
            data.records || [];


        totalTransactions +=
            records.length;


        console.log(
            `ERPLY transactions: page ${pageNo}, ${records.length} records`
        );


        // ------------------------------------------
        // No more records
        // ------------------------------------------

        if (
            records.length <
            recordsOnPage
        ) {

            break;

        }


        pageNo++;

    }


    console.log(
        `ERPLY total transactions for ${date}: ${totalTransactions}`
    );


    return totalTransactions;
}


// ==================================================
// MIDDLEWARE
// ==================================================

app.use(express.json());

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// ==================================================
// ALLOWED VALUES
// ==================================================

const allowed = {

    race: [
        "Black",
        "White",
        "Indian",
        "Asian",
        "Arabic"
    ],

    gender: [
        "Male",
        "Female"
    ],

    location: [
        "Local",
        "Foreign"
    ],

    age_group: [
        "30s",
        "40s",
        "50s",
        "60s",
        "over"
    ],

    regular_first_time: [
        "Regular",
        "First Time"
    ],

    salesperson: [
        "Sanele",
        "Nino",
        "Glory",
        "Sarah",
        "Mandy"
    ]
};


// ==================================================
// VALIDATION
// ==================================================

function validate(body) {

    if (!body.customer_date) {
        return "Date is required.";
    }

    for (const key of Object.keys(allowed)) {

        if (!allowed[key].includes(body[key])) {

            return `Invalid ${key}.`;

        }
    }

    return null;
}


// ==================================================
// DAILY SUMMARY
// ==================================================

app.get("/api/daily-summary", async (req, res) => {

    try {

        const selectedDate =
            req.query.date;


        if (!selectedDate) {

            return res.status(400).json({
                error:
                    "Date is required."
            });

        }


        console.log(
            "Loading daily summary for:",
            selectedDate
        );


        // ------------------------------------------
        // Count customer records
        // ------------------------------------------

        const customerResult =
            await pool.query(
                `
                SELECT COUNT(*)::int AS total
                FROM customers
                WHERE customer_date::date = $1::date
                `,
                [selectedDate]
            );


        const customerRecords =
            customerResult.rows[0].total;


        // ------------------------------------------
        // Count ERPLY transactions
        // ------------------------------------------

        const erplyTransactions =
            await getErplyTransactionCount(
                selectedDate
            );


        // ------------------------------------------
        // Outstanding Entries
        // ------------------------------------------

        const outstandingEntries =
            erplyTransactions -
            customerRecords;


        console.log(
            "Daily Summary:",
            {
                date: selectedDate,
                erplyTransactions,
                customerRecords,
                outstandingEntries
            }
        );


        res.json({

            totalSales:
                erplyTransactions,

            totalRecords:
                customerRecords,

            outstanding:
                outstandingEntries

        });

    } catch (error) {

        console.error(
            "Daily summary error:",
            error
        );


        res.status(500).json({

            error:
                "Could not load daily summary."

        });

    }

});


// ==================================================
// GET CUSTOMER RECORDS
// ==================================================

app.get("/api/customers", async (req, res) => {

    try {

        const selectedDate =
            req.query.date;


        console.log(
            "Loading customer records for:",
            selectedDate
        );


        // ------------------------------------------
        // Records for a specific date
        // ------------------------------------------

        if (selectedDate) {

            const result =
                await pool.query(
                    `
                    SELECT
                        id,

                        TO_CHAR(
                            customer_date,
                            'YYYY-MM-DD'
                        ) AS customer_date,

                        race,
                        gender,
                        location,
                        age_group,
                        regular_first_time,
                        salesperson

                    FROM customers

                    WHERE customer_date::date =
                          $1::date

                    ORDER BY id DESC
                    `,
                    [selectedDate]
                );


            console.log(
                `Found ${result.rows.length} records`
            );


            return res.json(
                result.rows
            );

        }


        // ------------------------------------------
        // All records
        // ------------------------------------------

        const result =
            await pool.query(
                `
                SELECT
                    id,

                    TO_CHAR(
                        customer_date,
                        'YYYY-MM-DD'
                    ) AS customer_date,

                    race,
                    gender,
                    location,
                    age_group,
                    regular_first_time,
                    salesperson

                FROM customers

                ORDER BY
                    customer_date DESC,
                    id DESC
                `
            );


        res.json(
            result.rows
        );

    } catch (error) {

        console.error(
            "Error loading customers:",
            error
        );


        res.status(500).json({

            error:
                "Could not load records."

        });

    }

});


// ==================================================
// ADD CUSTOMER
// ==================================================

app.post("/api/customers", async (req, res) => {

    const validationError =
        validate(req.body);


    if (validationError) {

        return res.status(400).json({

            error:
                validationError

        });

    }


    try {

        const body =
            req.body;


        const result =
            await pool.query(
                `
                INSERT INTO customers (
                    customer_date,
                    race,
                    gender,
                    location,
                    age_group,
                    regular_first_time,
                    salesperson
                )

                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7
                )

                RETURNING
                    id,

                    TO_CHAR(
                        customer_date,
                        'YYYY-MM-DD'
                    ) AS customer_date,

                    race,
                    gender,
                    location,
                    age_group,
                    regular_first_time,
                    salesperson,
                    created_at
                `,
                [
                    body.customer_date,
                    body.race,
                    body.gender,
                    body.location,
                    body.age_group,
                    body.regular_first_time,
                    body.salesperson
                ]
            );


        res.status(201).json({

            message:
                "Details have been added to the database.",

            customer:
                result.rows[0]

        });

    } catch (error) {

        console.error(error);


        res.status(500).json({

            error:
                "Could not save record."

        });

    }

});


// ==================================================
// EDIT CUSTOMER
// ==================================================

app.put("/api/customers/:id", async (req, res) => {

    const validationError =
        validate(req.body);


    if (validationError) {

        return res.status(400).json({

            error:
                validationError

        });

    }


    try {

        const body =
            req.body;


        const result =
            await pool.query(
                `
                UPDATE customers

                SET
                    customer_date = $1,
                    race = $2,
                    gender = $3,
                    location = $4,
                    age_group = $5,
                    regular_first_time = $6,
                    salesperson = $7

                WHERE id = $8

                RETURNING
                    id,

                    TO_CHAR(
                        customer_date,
                        'YYYY-MM-DD'
                    ) AS customer_date,

                    race,
                    gender,
                    location,
                    age_group,
                    regular_first_time,
                    salesperson,
                    created_at
                `,
                [
                    body.customer_date,
                    body.race,
                    body.gender,
                    body.location,
                    body.age_group,
                    body.regular_first_time,
                    body.salesperson,
                    req.params.id
                ]
            );


        if (!result.rowCount) {

            return res.status(404).json({

                error:
                    "Record not found."

            });

        }


        res.json({

            message:
                "Record updated successfully.",

            customer:
                result.rows[0]

        });

    } catch (error) {

        console.error(error);


        res.status(500).json({

            error:
                "Could not update record."

        });

    }

});


// ==================================================
// DELETE CUSTOMER
// ==================================================

app.delete("/api/customers/:id", async (req, res) => {

    try {

        const result =
            await pool.query(
                `
                DELETE FROM customers
                WHERE id = $1
                `,
                [req.params.id]
            );


        if (!result.rowCount) {

            return res.status(404).json({

                error:
                    "Record not found."

            });

        }


        res.json({

            message:
                "Record deleted successfully."

        });

    } catch (error) {

        console.error(error);


        res.status(500).json({

            error:
                "Could not delete record."

        });

    }

});


// ==================================================
// DOWNLOAD EXCEL
// ==================================================

app.get("/download", async (req, res) => {

    try {

        const result =
            await pool.query(
                `
                SELECT

                    TO_CHAR(
                        customer_date,
                        'YYYY-MM-DD'
                    ) AS "Date",

                    race AS "Race",

                    gender AS "Gender",

                    location AS "Location",

                    age_group AS "Age",

                    regular_first_time
                        AS "Regular/First Time",

                    salesperson
                        AS "Salesperson"

                FROM customers

                ORDER BY
                    customer_date,
                    id
                `
            );


        // ------------------------------------------
        // Create workbook
        // ------------------------------------------

        const workbook =
            XLSX.utils.book_new();


        // ------------------------------------------
        // Create worksheet
        // ------------------------------------------

        const worksheet =
            XLSX.utils.json_to_sheet(
                result.rows,
                {
                    header: [
                        "Date",
                        "Race",
                        "Gender",
                        "Location",
                        "Age",
                        "Regular/First Time",
                        "Salesperson"
                    ]
                }
            );


        // ------------------------------------------
        // Add worksheet
        // ------------------------------------------

        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            "Customers"
        );


        // ------------------------------------------
        // Download headers
        // ------------------------------------------

        res.setHeader(
            "Content-Disposition",
            'attachment; filename="customer_information.xlsx"'
        );

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );


        // ------------------------------------------
        // Send Excel file
        // ------------------------------------------

        res.send(
            XLSX.write(
                workbook,
                {
                    type: "buffer",
                    bookType: "xlsx"
                }
            )
        );

    } catch (error) {

        console.error(error);


        res.status(500).send(
            "Could not create Excel file."
        );

    }

});


// ==================================================
// START SERVER
// ==================================================

app.listen(PORT, () => {

    console.log(
        `Running on http://localhost:${PORT}`
    );

});