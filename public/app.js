
// ==================================================
// ELEMENTS
// ==================================================
const totalSales = document.getElementById("totalSales");
const totalRecords = document.getElementById("totalRecords");
const outstandingSales = document.getElementById("outstandingSales");

const form = document.getElementById("form");
const editForm = document.getElementById("editForm");

const rows = document.getElementById("rows");
const msg = document.getElementById("msg");
const count = document.getElementById("count");
const pageInfo = document.getElementById("page");

const editModal = document.getElementById("editModal");
const closeModal = document.getElementById("closeModal");
const cancelEdit = document.getElementById("cancelEdit");

const recordDate = document.getElementById("recordDate");
const previousDay = document.getElementById("previousDay");
const nextDay = document.getElementById("nextDay");


// ==================================================
// PAGINATION
// ==================================================

let data = [];
let page = 1;

const size = 10;

let editingId = null;


// ==================================================
// LOCAL DATE
// ==================================================

// Gets today's date using the computer's local timezone.

function getLocalDate() {

    const date = new Date();

    const year =
        date.getFullYear();

    const month =
        String(date.getMonth() + 1)
            .padStart(2, "0");

    const day =
        String(date.getDate())
            .padStart(2, "0");

    return `${year}-${month}-${day}`;
}


// ==================================================
// DATE NAVIGATION
// ==================================================

let selectedDate = getLocalDate();


// Set the form date to today

document.getElementById(
    "customer_date"
).value = selectedDate;


// Set the records date to today

recordDate.value = selectedDate;


// ==================================================
// ESCAPE HTML
// ==================================================

function esc(value) {

    return String(value).replace(
        /[&<>"']/g,
        character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[character])
    );

}


// ==================================================
// SHOW MESSAGE
// ==================================================

function show(message, error = false) {

    msg.textContent = message;

    msg.hidden = false;

    msg.style.background = error
        ? "#fef2f2"
        : "#ecfdf3";

    msg.style.color = error
        ? "#991b1b"
        : "#166534";

    setTimeout(() => {
        msg.hidden = true;
    }, 3000);

}
// ==================================================
// DAILY SUMMARY
// ==================================================



// ==================================================
// LOAD DAILY SUMMARY
// ==================================================

async function loadDailySummary() {

    try {

        const response = await fetch(
            `/api/daily-summary?date=${encodeURIComponent(selectedDate)}`
        );

        if (!response.ok) {

            throw new Error(
                "Could not load daily summary."
            );

        }

        const summary =
            await response.json();


        // ------------------------------------------
        // Total Sales Today
        // ------------------------------------------
        // Number of ERPLY transactions

        totalSales.textContent =
            Math.round(Number(summary.totalSales));


        // ------------------------------------------
        // Records Entered Today
        // ------------------------------------------

        totalRecords.textContent =
            Math.round(Number(summary.totalRecords));


        // ------------------------------------------
        // Outstanding Entries
        // ------------------------------------------
        // ERPLY transactions - customer records

        outstandingSales.textContent =
            Math.round(Number(summary.outstanding));


    } catch (error) {

        console.error(
            "Daily summary error:",
            error
        );

        totalSales.textContent = "0";

        totalRecords.textContent =
            Math.round(Number(data.length));

        outstandingSales.textContent = "0";

    }

}


// ==================================================
// RENDER TABLE
// ==================================================

function render() {

    const totalPages = Math.max(
        1,
        Math.ceil(data.length / size)
    );

    page = Math.min(
        page,
        totalPages
    );


    const start =
        (page - 1) * size;

    const end =
        page * size;


    const currentPageData =
        data.slice(start, end);


    // ----------------------------------------------
    // Display records
    // ----------------------------------------------

    if (currentPageData.length) {

        rows.innerHTML =
            currentPageData
                .map(customer => `

                    <tr>

                        <td>
                            ${esc(
                                customer.customer_date
                            )}
                        </td>

                        <td>
                            ${esc(
                                customer.race
                            )}
                        </td>

                        <td>
                            ${esc(
                                customer.gender
                            )}
                        </td>

                        <td>
                            ${esc(
                                customer.location
                            )}
                        </td>

                        <td>
                            ${esc(
                                customer.age_group
                            )}
                        </td>

                        <td>
                            ${esc(
                                customer.regular_first_time
                            )}
                        </td>

                        <td>
                            ${esc(
                                customer.salesperson
                            )}
                        </td>

                        <td class="actions">

                            <button
                                class="edit"
                                onclick="editRec(${customer.id})"
                            >
                                Edit
                            </button>

                            <button
                                class="del"
                                onclick="delRec(${customer.id})"
                            >
                                Delete
                            </button>

                        </td>

                    </tr>

                `)
                .join("");

    } else {

        rows.innerHTML = `

            <tr>

                <td colspan="8">
                    No records found for this date.
                </td>

            </tr>

        `;

    }


    // ----------------------------------------------
    // Record count
    // ----------------------------------------------

    count.textContent =
        `${data.length} record${data.length === 1 ? "" : "s"}`;


    // ----------------------------------------------
    // Page information
    // ----------------------------------------------

    pageInfo.textContent =
        `Page ${page} of ${totalPages}`;

}


// ==================================================
// LOAD RECORDS FOR SELECTED DATE
// ==================================================


// ==================================================
// LOAD RECORDS FOR SELECTED DATE
// ==================================================

async function load() {

    try {

        // Show loading message while fetching records

        rows.innerHTML = `
            <tr>
                <td colspan="8" class="loading">
                    Loading records...
                </td>
            </tr>
        `;


        // Get records for the selected date

        const response = await fetch(
            `/api/customers?date=${encodeURIComponent(selectedDate)}`
        );


        if (!response.ok) {

            throw new Error(
                "Failed to load records."
            );

        }


        const records =
            await response.json();


        // Replace the current table data
        // with records from the selected date

        data = records;


        // Always start on page 1

        page = 1;


        // Display the records

        render();


        // Update the three summary cards

        loadDailySummary();


    } catch (error) {

        console.error(
            "Error loading records:",
            error
        );


        // Clear existing records

        data = [];

        page = 1;


        // Show No Records

        rows.innerHTML = `
            <tr>
                <td colspan="8">
                    No Records
                </td>
            </tr>
        `;


        // Reset pagination

        count.textContent = "0 records";

        pageInfo.textContent =
            "Page 1 of 1";


        // Reset summary cards

        totalSales.textContent = "0";

        totalRecords.textContent = "0";

        outstandingSales.textContent = "0";


        show(
            "Could not load records.",
            true
        );

    }

}
// ==================================================
// CHANGE SELECTED DATE
// ==================================================

function changeDate(date) {

    selectedDate = date;

    recordDate.value = selectedDate;

    page = 1;

    load();

}


// ==================================================
// DATE PICKER
// ==================================================

recordDate.addEventListener(
    "change",
    () => {

        if (!recordDate.value) {
            return;
        }

        changeDate(
            recordDate.value
        );

    }
);


// ==================================================
// PREVIOUS DAY
// ==================================================

previousDay.onclick = () => {

    const date =
        new Date(
            selectedDate + "T12:00:00"
        );


    date.setDate(
        date.getDate() - 1
    );


    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");


    changeDate(
        `${year}-${month}-${day}`
    );

};


// ==================================================
// NEXT DAY
// ==================================================

nextDay.onclick = () => {

    const date =
        new Date(
            selectedDate + "T12:00:00"
        );


    date.setDate(
        date.getDate() + 1
    );


    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");


    changeDate(
        `${year}-${month}-${day}`
    );

};


// ==================================================
// ADD CUSTOMER
// ==================================================

form.onsubmit = async event => {

    event.preventDefault();


    const body =
        Object.fromEntries(
            new FormData(form)
        );


    try {

        const response =
            await fetch(
                "/api/customers",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(body)
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            return show(
                result.error,
                true
            );

        }


        show(result.message);


        form.reset();


        // Reset form date to today

        document.getElementById(
            "customer_date"
        ).value =
            getLocalDate();


        // Reload current table

        load();

    } catch (error) {

        console.error(error);

        show(
            "Could not save record.",
            true
        );

    }

};


// ==================================================
// OPEN EDIT MODAL
// ==================================================

window.editRec = id => {

    const customer =
        data.find(
            item => item.id === id
        );


    if (!customer) {
        return;
    }


    editingId = id;


    document.getElementById(
        "edit_customer_date"
    ).value =
        customer.customer_date;


    document.getElementById(
        "edit_race"
    ).value =
        customer.race;


    document.getElementById(
        "edit_gender"
    ).value =
        customer.gender;


    document.getElementById(
        "edit_location"
    ).value =
        customer.location;


    document.getElementById(
        "edit_age_group"
    ).value =
        customer.age_group;


    document.getElementById(
        "edit_regular_first_time"
    ).value =
        customer.regular_first_time;


    document.getElementById(
        "edit_salesperson"
    ).value =
        customer.salesperson;


    editModal.hidden = false;

};


// ==================================================
// SAVE EDITED CUSTOMER
// ==================================================

editForm.onsubmit = async event => {

    event.preventDefault();


    if (!editingId) {
        return;
    }


    const body =
        Object.fromEntries(
            new FormData(editForm)
        );


    try {

        const response =
            await fetch(
                `/api/customers/${editingId}`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(body)
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            return show(
                result.error,
                true
            );

        }


        closeEditModal();


        show(result.message);


        // If the date was changed during editing,
        // reload the currently selected date.

        load();

    } catch (error) {

        console.error(error);

        show(
            "Could not update record.",
            true
        );

    }

};


// ==================================================
// CLOSE EDIT MODAL
// ==================================================

function closeEditModal() {

    editModal.hidden = true;

    editingId = null;

    editForm.reset();

}


// ==================================================
// CLOSE MODAL BUTTON
// ==================================================

closeModal.onclick = () => {

    closeEditModal();

};


// ==================================================
// CANCEL EDIT
// ==================================================

cancelEdit.onclick = () => {

    closeEditModal();

};


// ==================================================
// CLICK OUTSIDE MODAL
// ==================================================

editModal.onclick = event => {

    if (
        event.target === editModal
    ) {

        closeEditModal();

    }

};


// ==================================================
// DELETE CUSTOMER
// ==================================================

window.delRec = async id => {

    const confirmed =
        confirm(
            "Are you sure you want to delete this record?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await fetch(
                `/api/customers/${id}`,
                {
                    method: "DELETE"
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            return show(
                result.error,
                true
            );

        }


        show(result.message);


        load();

    } catch (error) {

        console.error(error);

        show(
            "Could not delete record.",
            true
        );

    }

};


// ==================================================
// PREVIOUS TABLE PAGE
// ==================================================

document.getElementById(
    "prev"
).onclick = () => {

    if (page > 1) {

        page--;

        render();

    }

};


// ==================================================
// NEXT TABLE PAGE
// ==================================================

document.getElementById(
    "next"
).onclick = () => {

    const totalPages =
        Math.ceil(
            data.length / size
        );


    if (page < totalPages) {

        page++;

        render();

    }

};


// ==================================================
// INITIAL LOAD
// ==================================================

load();