// src/composables/useMenuRatings.js
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getAuth } from 'firebase/auth'
import { 
  getFirestore, 
  doc, 
  collection, 
  onSnapshot,
  getDoc,
  runTransaction,
  serverTimestamp 
} from 'firebase/firestore'

export function useMenuRatings(recipeId) {
  const auth = getAuth()
  const db = getFirestore()
  const uid = ref(auth.currentUser?.uid)
  const ratingCount = ref(0)
  const ratingSum = ref(0)
  const userStars = ref(0)
  const hasRated = ref(false)

  // Check if user has already rated
  async function checkUserRating() {
    if (!uid.value) return
    
    const userRatingRef = doc(collection(db, 'recipes', recipeId, 'ratings'), uid.value)
    const ratingDoc = await getDoc(userRatingRef)
    
    if (ratingDoc.exists()) {
      hasRated.value = true
      userStars.value = ratingDoc.data().stars
    }
  }

  async function setRating(stars) {
    if (!uid.value) throw new Error('Please login to rate')
    if (hasRated.value) throw new Error('You have already rated this recipe')
    if (stars < 1 || stars > 5) throw new Error('Rating must be between 1-5')

    try {
      await runTransaction(db, async (transaction) => {
        const recipeRef = doc(db, 'recipes', recipeId)
        const userRatingRef = doc(collection(recipeRef, 'ratings'), uid.value)
        
        // Check if user has already rated
        const ratingDoc = await transaction.get(userRatingRef)
        if (ratingDoc.exists()) {
          throw new Error('You have already rated this recipe')
        }

        // Get recipe document
        const recipeDoc = await transaction.get(recipeRef)
        const recipeData = recipeDoc.exists() ? recipeDoc.data() : { ratingCount: 0, ratingSum: 0 }

        // Update recipe aggregate data
        transaction.set(recipeRef, {
          ratingCount: (recipeData.ratingCount || 0) + 1,
          ratingSum: (recipeData.ratingSum || 0) + stars
        }, { merge: true })

        // Create user rating
        transaction.set(userRatingRef, {
          stars,
          userId: uid.value,
          createdAt: serverTimestamp()
        })
      })

      hasRated.value = true
      userStars.value = stars
      return true
    } catch (error) {
      console.error('Rating error:', error)
      throw error
    }
  }

  // Subscribe to recipe data
  const unsubRecipe = onSnapshot(doc(db, 'recipes', recipeId), (doc) => {
    const data = doc.data() || {}
    ratingCount.value = data.ratingCount || 0
    ratingSum.value = data.ratingSum || 0
  })

  // Check initial rating on mount
  onMounted(() => {
    checkUserRating()
    
    // Listen for auth state changes
    const unsubAuth = auth.onAuthStateChanged(user => {
      uid.value = user?.uid
      if (user) {
        checkUserRating()
      } else {
        hasRated.value = false
        userStars.value = 0
      }
    })

    onUnmounted(() => {
      unsubRecipe()
      unsubAuth()
    })
  })

  return {
    ratingCount,
    ratingSum,
    userStars,
    hasRated,
    setRating,
    uid: computed(() => uid.value),
    avg: computed(() => ratingCount.value ? ratingSum.value / ratingCount.value : 0)
  }
}
