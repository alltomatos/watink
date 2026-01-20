import React, { createContext, useState, useContext } from "react";

const TicketsContext = createContext();

const TicketsProvider = ({ children }) => {
    const [tabOpen, setTabOpen] = useState("open");

    return (
        <TicketsContext.Provider value={{ tabOpen, setTabOpen }}>
            {children}
        </TicketsContext.Provider>
    );
};

const useTicketsContext = () => {
    const context = useContext(TicketsContext);
    if (!context) {
        throw new Error("useTicketsContext must be used within a TicketsProvider");
    }
    return context;
};

export { TicketsContext, TicketsProvider, useTicketsContext };
