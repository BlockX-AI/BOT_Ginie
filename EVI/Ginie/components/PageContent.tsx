"use client";

import { useEffect, useState } from 'react'
import Loader from '@/components/Loader'
import Hero from '@/components/Hero'
import ThreePillars from '@/components/ThreePillars'
import Features from '@/components/Features'
// import HowItWorks from '@/components/HowItWorks'
import Templates from '@/components/Templates'

import { Footer } from '@/components/Footer'
import ReferenceSection from '@/components/ReferenceSection'
import Services from '@/components/Services'

export default function PageContent() {
  const [isLoading, setIsLoading] = useState(true)

  return (
    <>
  <Loader isLoading={isLoading} onFinish={() => setIsLoading(false)} />
      <main id="top" className="relative min-h-screen pt-4 font-playfair font-normal">
        {/* Hero stays sticky at z-0; following content placed in z-10 so it scrolls over the hero */}
        <Hero />
        
        <div className="relative z-10 bg-black">
          <ReferenceSection />
          <ThreePillars />
          <Features />

          {/* Services showcase like the reference, centered and compact */}
          <div className="mt-4 md:mt-10 lg:mt-8">
            <Services />
          </div>
          
          <Footer />
        </div>
      </main>
    </>
  )
}
