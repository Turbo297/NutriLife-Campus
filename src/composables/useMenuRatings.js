// src/composables/useMenuRatings.js
import { ref, computed, onUnmounted } from 'vue'
import { getAuth } from 'firebase/auth'
import { 
  getFirestore, 
  doc, 
  collection, 
  setDoc,
  updateDoc,
  increment,
  onSnapshot 
} from 'firebase/firestore'

export function useMenuRatings(recipeId) {
  const auth = getAuth()
  const db = getFirestore()
  
  // Initialize refs
  const uid = ref(auth.currentUser?.uid)
  const ratingCount = ref(0)
  const ratingSum = ref(0)
  const userStars = ref(0)
  
  // Create references
  const recipeRef = doc(db, 'recipes', recipeId)
  
  async function setRating(stars) {
    if (!uid.value) throw new Error('Please login to rate')
    
    try {
      // First create/update the recipe document if it doesn't exist
      await setDoc(recipeRef, {
        ratingCount: increment(1),
        ratingSum: increment(stars)
      }, { merge: true })
      
      // Then create the user's rating
      const userRatingRef = doc(collection(recipeRef, 'ratings'), uid.value)
      await setDoc(userRatingRef, {
        stars,
        userId: uid.value,
        timestamp: new Date()
      })
      
      return true
    } catch (error) {
      console.error('Rating error:', error)
      return false
    }
  }

  // Subscribe to recipe ratings
  onSnapshot(recipeRef, (doc) => {
    if (doc.exists()) {
      const data = doc.data()
      ratingCount.value = data.ratingCount || 0
      ratingSum.value = data.ratingSum || 0
    }
  })

  // Cleanup function
  onUnmounted(() => {
    // Cleanup subscriptions if needed
  })

  return {
    ratingCount,
    ratingSum,
    userStars,
    setRating,
    uid: computed(() => uid.value),
    avg: computed(() => 
      ratingCount.value ? ratingSum.value / ratingCount.value : 0
    )
  }
}
