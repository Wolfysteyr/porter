import { AppContext } from "../Context/AppContext";
import { React, useEffect, useState, useContext } from "react";
import Popover from "@mui/material/Popover";
import ListAltRoundedIcon from "@mui/icons-material/ListAltRounded";

export default function LastUpdatePopover({ template, loading }) {

    // get app context values
    const { appAddress, user, token } = useContext(AppContext);

    // Popover state
    const [anchorEl1, setAnchorEl1] = useState(null);
    const open1 = Boolean(anchorEl1);
    const id1 = open1 ? "last-update-popover" : undefined;

    const [anchorEl2, setAnchorEl2] = useState(null);
    const open2 = Boolean(anchorEl2);
    const id2 = open2 ? "last-update-popover-2" : undefined;

        // Handlers to open/close popover
    const handleClick1 = (event) => {
        setAnchorEl1(event.currentTarget);
    };
    const handleClose1 = () => {
        setAnchorEl1(null);
    };

    const handleClick2 = (event) => {
        setAnchorEl2(event.currentTarget);
    }
    const handleClose2 = () => {
        setAnchorEl2(null);
    }

    const lastUpdate = template.updated_at;

    // template history data state
    const [history, setHistory] = useState([]); // contains the entire history for this template
        

    // users data state
    const [users, setUsers] = useState([]);

    // fetch template history data
    async function fetchTemplateHistory() {
        try {
            const response = await fetch(
                `${appAddress}/api/templates/${encodeURIComponent(template.id)}/history`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    credentials: "include",
                },
            );
            if (response.ok) {
                const data = await response.json();
                return data;
            }
        } catch (error) {
            console.error("Error fetching template history:", error);
        }
    }

    async function fetchUsers(){
        try {
            const response = await fetch(`${appAddress}/api/users`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                credentials: "include",
            });
            if (response.ok) {
                const data = await response.json();
                return data;
            }   
        } catch (error) {
            console.error("Error fetching users:", error);
        }
    }

    // set history data and users
    useEffect(() => {
        let isMounted = true;

        async function loadData() {
            const [historyData, usersData] = await Promise.all([
                fetchTemplateHistory(),
                fetchUsers(),
            ]);

            if (!isMounted) return;

            setHistory(Array.isArray(historyData) ? historyData : []);
            setUsers(Array.isArray(usersData) ? usersData : []);
        }

        loadData();
        return () => {
            isMounted = false;
        };

    }, [template]);

    // handle getting changes for each history entry
    // compares the current (selected) template with the previous version of the template to determine what was changed
    // like git diff but for templates


    function historyDiff(historyId) {
        // something is screwing up with this function and causing the popover to either open doubly or show incorrect data
        // leaving it unimplemented for now
        // need to understand how to even implement this properly
        // what needs to be done: get the current entry's template data and the previous entry's template data
        // compare the two and determine what changed
        // go over each and every field and see if it changed, meaning needing a whole lot of checking for each field in the template object
        // return that data to be displayed in the popover in a way that looks good which could be hard since its not code
        // each change needs its own <li> element in the popover, what changed and from what to what (added, removed, modified), without looking cluttered
        // i hate it here
    }


    return (
        <div>
            <span
                id={id1}
                style={{ textDecoration: "dotted underline", cursor: "help", textDecorationThickness: '2px' }}
                onClick={handleClick1}
            >
                {loading ? "Loading..." : lastUpdate ? new Date(lastUpdate).toLocaleDateString() : "N/A"}
                <ListAltRoundedIcon 
                    style={{paddingLeft: '5px', verticalAlign: 'middle', fontSize: '18px'}}
                />
            </span>
            <Popover
                id={id1}
                open={open1}
                anchorEl={anchorEl1}
                onClose={handleClose1}
                anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "center",
                }}
                transformOrigin={{
                    vertical: "top",
                    horizontal: "center",
                }}
            >
                <div style={{ padding: "1rem", maxWidth: "300px" }}>
                    <h3 style={{ marginTop: 0 }}>Update History</h3>
                    {history.length === 0 ? (
                        <p>No update history available.</p>
                    ) : (
                        <ul style={{ paddingLeft: "1.2rem", margin: 0 }}>
                            {history.map((entry, index) => (
                                <li key={index} style={{ marginBottom: "0.5rem" }}>
                                    <strong className="popover-history" onClick={handleClick2}>{new Date(entry.updated_at).toLocaleString()}</strong>
                                    <Popover
                                        id={id2}
                                        open={open2}
                                        anchorEl={anchorEl2}
                                        onClose={handleClose2}
                                        anchorOrigin={{
                                            vertical: "center",
                                            horizontal: "right",
                                        }}
                                        transformOrigin={{
                                            vertical: "top",
                                            horizontal: "left",
                                        }}
                                    >
                                        <div style={{ padding: "1rem", maxWidth: "300px", backgroundColor: "#c5c5c5" }}>
                                            <p>Committed by <span style={{fontWeight:"bold"}}>{users.find(user => user.id === entry.committed_by)?.name || "Unknown"}</span></p>
                                            <hr style={{border: "1px solid #000"}}/>
                                            <p><strong>Changes:</strong></p>
                                            <ul style={{ paddingLeft: "1.2rem", margin: 0 }}>
                                              
                                            </ul>
                                        </div>
                                    </Popover>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </Popover>
        </div>
    );
}
