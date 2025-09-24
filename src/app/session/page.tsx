"use client";

import Hero from "../../components/Hero";

export default function SessionPageBlank() {
    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8">
            <main className="flex flex-col items-center gap-8 max-w-md w-full">
                <Hero />

                <div className="text-white text-center">
                    Please go to the echo session link we texted you :)
                </div>
            </main>
        </div>
    )
}