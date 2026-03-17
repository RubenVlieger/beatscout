'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

export default function SoundCloudCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const token = searchParams.get('token')
    const error = searchParams.get('error')

    if (error) {
      console.error('SoundCloud OAuth error:', error)
      router.push('/auth/login?error=soundcloud_failed')
      return
    }

    if (token) {
      localStorage.setItem('token', token)
      router.push('/dashboard')
    } else {
      router.push('/auth/login?error=no_token')
    }
  }, [searchParams, router])

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center"
      >
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white">Connecting SoundCloud...</h2>
        <p className="text-slate-400 mt-2">Please wait while we link your account</p>
      </motion.div>
    </div>
  )
}
