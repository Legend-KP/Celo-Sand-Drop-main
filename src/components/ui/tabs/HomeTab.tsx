"use client";

import { useState, useEffect, useMemo } from "react";
import { Trophy, Sparkles, Award } from "lucide-react";
import { useMiniApp } from "@neynar/react";
import { ShareButton } from "../Share";
import { APP_URL } from "~/lib/constants";
import { 
  getUserByFid,
  getUserRank,
  getLeaderboard,
  subscribeToLeaderboard,
  subscribeToUser,
  type UserFlowData,
  type LeaderboardEntry
} from "~/lib/firebase";

/**
 * HomeTab component displays the Flow Points checker interface.
 * 
 * This component shows the user's Flow Points score, leaderboard, and info.
 * It integrates with Farcaster to get user data and displays their gaming statistics.
 */
export function HomeTab() {
  const { context, actions, added } = useMiniApp();
  const safeAreaBottom = context?.client.safeAreaInsets?.bottom ?? 0;
  const [view, setView] = useState<'score' | 'leaderboard' | 'info'>('score');
  const [userData, setUserData] = useState<UserFlowData | null>(null);
  const [userRank, setUserRank] = useState({ rank: 0, total: 0, percentile: 0 });
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<'page1' | 'page2' | 'complete'>('page1');
  const [showNoUserModal, setShowNoUserModal] = useState(false);

  // Check onboarding status on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
      const isFirstTime = !hasSeenOnboarding;
      setShowOnboarding(isFirstTime);
      // First-time users start on page1, returning users start on page2
      setOnboardingStep(isFirstTime ? 'page1' : 'page2');
      // For returning users, set Points (score) as default tab
      if (!isFirstTime) {
        setView('score');
      }
    }
  }, []);

  // Show Farcaster's native add dialog when frame is not added
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // If added is undefined (still loading), don't do anything
      if (added === undefined) {
        return;
      }
      
      // Check if user has already dismissed the prompt
      const hasDismissedAddPrompt = localStorage.getItem('hasDismissedAddPrompt') === 'true';
      
      // Check if app was previously added
      const appWasAdded = localStorage.getItem('appAddedToClient') === 'true';
      
      // If app is currently added, mark it in localStorage and return early
      if (added === true) {
        localStorage.setItem('appAddedToClient', 'true');
        return;
      }
      
      // Only trigger if ALL conditions are met:
      // 1. Frame is explicitly NOT added (added === false, not undefined or true)
      // 2. Onboarding is complete
      // 3. User hasn't dismissed it before
      // 4. App was never added before
      if (added === false && 
          onboardingStep === 'complete' && 
          showOnboarding === false && 
          !hasDismissedAddPrompt && 
          !appWasAdded) {
        
        // Small delay for smooth UX
        const timer = setTimeout(() => {
          // Directly trigger Farcaster's native dialog
          actions.addMiniApp();
          // Mark as shown so it doesn't trigger again
          localStorage.setItem('hasDismissedAddPrompt', 'true');
        }, 500);
        
        return () => clearTimeout(timer);
      }
    }
  }, [added, onboardingStep, showOnboarding, actions]);

  // Show no user modal when user is not in database after onboarding completes
  useEffect(() => {
    if (onboardingStep === 'complete' && showOnboarding === false && !loading) {
      if (!userData) {
        // Small delay to ensure smooth transition
        const timer = setTimeout(() => {
          setShowNoUserModal(true);
        }, 500);
        return () => clearTimeout(timer);
      } else {
        // Hide modal if user data becomes available
        setShowNoUserModal(false);
      }
    }
  }, [onboardingStep, showOnboarding, loading, userData]);


  // Fetch user data from Firebase
  useEffect(() => {
    // Get FID from context
    const fid = context?.user?.fid;
    
    if (!fid) {
      setLoading(false);
      return;
    }

    //console.log('Loading data for FID:', fid);

    // Initial data load
    const loadInitialData = async () => {
      try {
        // Fetch user data (always fetches username from Farcaster/Neynar)
        const user = await getUserByFid(fid);
        //console.log('User data:', user);
        
        if (user) {
          setUserData(user);
          
          // Get user's rank
          const rankData = await getUserRank(fid);
          //console.log('Rank data:', rankData);
          setUserRank(rankData);
        }

        // Fetch leaderboard (always fetches usernames from Farcaster/Neynar)
        const leaderboard = await getLeaderboard(100);
        //console.log('Leaderboard:', leaderboard);
        setLeaderboardData(leaderboard);

        setLoading(false);
      } catch (err) {
        //console.error('Error loading data:', err);
        setError('Failed to load data');
        setLoading(false);
      }
    };

    loadInitialData();

    // Subscribe to real-time updates
    const unsubscribeUser = subscribeToUser(fid, (user) => {
      if (user) {
        setUserData(user);
        
        // Update rank when user data changes
        getUserRank(fid).then(rankData => {
          setUserRank(rankData);
        });
      }
    });

    const unsubscribeLeaderboard = subscribeToLeaderboard(100, (leaderboard) => {
      // Leaderboard already enriched with usernames from Neynar in the subscription
      setLeaderboardData(leaderboard);
    });

    // Cleanup subscriptions
    return () => {
      unsubscribeUser();
      unsubscribeLeaderboard();
    };
  }, [context?.user?.fid]);

  // Handle onboarding navigation
  const handleGetStarted = () => {
    // Move from Page 1 to Page 2 for first-time users
    setOnboardingStep('page2');
  };

  const handleViewFlowPoints = () => {
    // Complete onboarding and show main app
    if (typeof window !== 'undefined') {
      localStorage.setItem('hasSeenOnboarding', 'true');
    }
    setShowOnboarding(false);
    setOnboardingStep('complete');
    // Set Points as the default tab after onboarding
    setView('score');
  };

  // Show onboarding screens
  if (showOnboarding === null) {
    // Still checking localStorage
    return (
      <div className="min-h-[calc(100vh-200px)] bg-gradient-to-br from-white via-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600 mb-4"></div>
        </div>
      </div>
    );
  }

  // First-time user onboarding (Page 1)
  if (showOnboarding && onboardingStep === 'page1') {
    return (
      <div className="min-h-[calc(100vh-200px)] bg-gradient-to-br from-white via-gray-50 to-white flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">GFlow!</h1>
          <p className="text-lg text-gray-600 mb-8 leading-relaxed">
            Welome to $Flow Points Checker: here you can Track your Flow Points in real-time and get $FLOW updates.
          </p>
          <button
            onClick={handleGetStarted}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-4 px-6 rounded-2xl shadow-lg transition-all transform hover:scale-[1.02]"
          >
            Get Started
          </button>
        </div>
      </div>
    );
  }

  // Page 2 - Show for both first-time users (after Page 1) and returning users
  if (onboardingStep === 'page2') {
    return (
      <div className="h-screen flex items-center justify-center bg-black px-6 overflow-hidden">
        <div className="text-center max-w-md w-full bg-white rounded-2xl p-8 shadow-lg">
          <img 
            src="https://i.ibb.co/G44pd6Nz/Circle-Coin.png" 
            alt="Flow Coin" 
            className="h-32 w-auto mx-auto mb-4"
          />
          <h2 className="text-3xl font-bold text-gray-900 mb-4">$FLOW SOON</h2>
          <p className="text-lg text-gray-600 mb-8">
          Flow Points (FP) represent your time spent well on Farcaster and The Base App.


          </p>
          <button
            onClick={handleViewFlowPoints}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-4 px-6 rounded-2xl shadow-lg transition-all transform hover:scale-[1.02]"
          >
            REVEAL YOUR FLOW POINTS
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className="flex flex-col bg-black overflow-hidden" style={{ 
      position: 'fixed',
      top: 0,
      left: '50%',
      right: '50%',
      marginLeft: '-50vw',
      marginRight: '-50vw',
      width: '100vw',
      height: '100vh',
      minHeight: '100vh',
      maxWidth: '100vw',
      maxHeight: '100vh'
    }}>
      {/* Top Panel with Trenchy Logo - Fixed */}
      <div className="fixed top-0 left-0 right-0 z-50 px-3 pt-2 pb-2" style={{ paddingTop: `${Math.max(context?.client.safeAreaInsets?.top ?? 0, 8)}px` }}>
        <div className="bg-gradient-to-br from-white via-gray-50 to-white rounded-2xl p-2 shadow-lg flex justify-center max-w-2xl mx-auto">
          <img 
            src="https://i.ibb.co/gZhv20PM/1-1-removebg-preview.png" 
            alt="Trenchy" 
            className="h-12 w-auto"
          />
        </div>
      </div>
      
      {/* Content - Different overflow handling for different views */}
      <div className={`flex-1 px-4 pt-20 pb-20 overflow-y-auto`}>
        {view === 'score' && !userData && !loading ? (
          <div className="min-h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">🌀</div>
              <p className="text-xl font-semibold text-gray-700 mb-2">You have 0 Flow Points</p>
              <p className="text-gray-500 mb-6">Go Earn Flow Points</p>
              <button 
                onClick={() => actions.openUrl('https://farcaster.xyz/miniapps/0JqfZe0oRgF8/flow')}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-4 px-8 rounded-2xl shadow-lg transition-all transform hover:scale-[1.02]"
              >
                Earn Flow Points
              </button>
            </div>
          </div>
        ) : view === 'score' && userData ? (
          <div className="min-h-full flex flex-col gap-6 py-4">
            {/* Main Score Card */}
            <div className="bg-gradient-to-br from-purple-500 via-purple-600 to-pink-500 rounded-3xl p-8 text-white shadow-xl">
              <div className="text-center">
                {userData.pfpUrl || context?.user?.pfpUrl ? (
                  <img 
                    src={userData.pfpUrl || context?.user?.pfpUrl || ''} 
                    alt={userData.displayName || userData.username || 'User'}
                    className="w-20 h-20 rounded-full mx-auto mb-4 border-4 border-white/30"
                  />
                ) : (
                  <div className="text-6xl mb-4">🌀</div>
                )}
                <h2 className="text-2xl font-bold mb-2">
                  {userData.displayName || userData.username || 'User'}&apos;s Flow Points
                </h2>
                <div className="flex items-center justify-center gap-2 mb-6">
                  <Sparkles size={20} className="text-yellow-300" />
                  <span className="text-5xl font-bold">
                    {userData.flowPoints?.toLocaleString() || 0}
                  </span>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl py-3 px-6 inline-block">
                  <p className="text-sm opacity-90">Top {userRank.percentile}%</p>
                  <p className="text-lg font-bold">Rank #{userRank.rank}</p>
                </div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="space-y-3">
              <button 
                onClick={() => actions.openUrl('https://farcaster.xyz/miniapps/0JqfZe0oRgF8/flow')}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold text-base py-4 px-6 rounded-2xl shadow-lg transition-all transform hover:scale-[1.02]"
              >
                 Earn Flow Points (FP)
              </button>
              {context?.user?.fid && (
                <ShareButton
                  buttonText="Share (+50 FP)"
                  cast={{
                    text: `Check out my Flow Points! 🎮\n$FLOW Coming soon by @trenchverse 👀`,
                    embeds: [`${APP_URL}/share/${context.user.fid}?fp=${userData?.flowPoints || 0}&t=${Date.now()}`],
                    //                                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                    //                                              ADD TIMESTAMP to force fresh fetch
                  }}
                  userData={userData}
                  className="!w-full !max-w-none !mx-0 !block bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold text-base py-4 px-6 rounded-2xl shadow-lg transition-all transform hover:scale-[1.02] border-0"
                />
              )}
            </div>
          </div>
        ) : view === 'leaderboard' ? (
          <div className="space-y-4">
            {/* Leaderboard Header */}
            <div className="bg-gradient-to-br from-white via-gray-50 to-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Global Leaderboard</h2>
                  <p className="text-sm text-gray-500">Top Flow Points (FP) earners</p>
                </div>
                <Trophy size={32} className="text-purple-500" />
              </div>
            </div>

            {/* Top 3 Podium */}
            {leaderboardData.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                {leaderboardData.slice(0, 3).map((user, idx) => (
                  <div key={user.rank} className={`${idx === 0 ? 'col-span-3 order-1' : idx === 1 ? 'order-2' : 'order-3'}`}>
                    <div className={`bg-gradient-to-br ${
                      idx === 0 ? 'from-yellow-400 to-yellow-500 p-6' : 
                      idx === 1 ? 'from-gray-300 to-gray-400 p-5' : 
                      'from-orange-400 to-orange-500 p-5'
                    } rounded-2xl text-white shadow-lg`}>
                      <div className="text-center">
                        {user.avatar && user.avatar !== '🌀' && !user.avatar.startsWith('http') ? (
                          <div className={`${idx === 0 ? 'text-5xl' : 'text-4xl'} mb-2`}>{user.avatar}</div>
                        ) : user.avatar && user.avatar.startsWith('http') ? (
                          <img 
                            src={user.avatar} 
                            alt={user.username}
                            className={`${idx === 0 ? 'w-16 h-16' : 'w-12 h-12'} rounded-full mx-auto mb-2 border-2 border-white/30`}
                          />
                        ) : (
                          <div className={`${idx === 0 ? 'text-5xl' : 'text-4xl'} mb-2`}>🌀</div>
                        )}
                        <div className={`${idx === 0 ? 'text-4xl' : 'text-3xl'} font-bold mb-1`}>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                        </div>
                        <p className={`${idx === 0 ? 'text-lg' : 'text-base'} font-bold mb-1`}>{user.username}</p>
                        <p className={`${idx === 0 ? 'text-2xl' : 'text-xl'} font-bold`}>
                          {user.points.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Rest of Leaderboard */}
            <div className="bg-gradient-to-br from-white via-gray-50 to-white rounded-2xl shadow-sm divide-y divide-gray-100">
              {leaderboardData.slice(3).map((entry) => (
                <div
                  key={entry.fid}
                  className={`p-4 hover:bg-gray-50 transition-colors ${
                    entry.fid === context?.user?.fid ? 'bg-purple-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center font-bold text-purple-700">
                        #{entry.rank}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {entry.username}
                          {entry.fid === context?.user?.fid && (
                            <span className="ml-2 text-xs text-purple-600">(You)</span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500">FID: {entry.fid}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-gray-900">{entry.points.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">Flow Points</p>
                    </div>
                  </div>
                </div>
              ))}
              {leaderboardData.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <p>No leaderboard data available yet.</p>
                </div>
              )}
            </div>

            {/* User's Position */}
            {userData && userRank.rank > 10 && (
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-5 text-white shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center font-bold">
                      #{userRank.rank}
                    </div>
                    <div>
                      <p className="font-semibold">
                        You ({userData.displayName || userData.username || 'User'})
                      </p>
                      <p className="text-sm opacity-90">Keep flowing to climb higher</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-xl">{userData.flowPoints?.toLocaleString() || 0}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-white via-gray-50 to-white rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900 text-center mb-4">$FLOW COMING SOON!</h2>
                <img 
                  src="https://i.ibb.co/G44pd6Nz/Circle-Coin.png" 
                  alt="Flow Coin" 
                  className="h-32 w-auto mb-4"
                />
              </div>
              <div className="space-y-4 text-gray-600">
                <p>
                  $FLOW is less of a token and more of a memory of time spent well on Farcaster and Base App.
                </p>
                <p>
                  Flow Points are your gateway to the upcoming $FLOW airdrop.
                </p>
                <p>
                  You earn Flow Points (FP) every time you spend coins in the Flow app or any Flow game.
                </p>
                <p>
                  1 Coin Spent = 1 Flow Point (FP)
                </p>
                <p>
                Earn Points through Fun.....not Farming 😉
                </p>
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 mt-4">
                  <p className="text-sm font-medium text-purple-900">
                    Flow Points ∝ $FLOW soon 👀
                  </p>
                </div>
                <p className="text-center text-gray-600 mt-4">
                Tokenomics soon...
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tab Navigation - Moved to bottom */}
      <div 
        className="fixed left-0 right-0 z-50 px-3"
        style={{ bottom: `${Math.max(safeAreaBottom, 8)}px` }}
      >
        <div className="bg-gradient-to-br from-white via-gray-50 to-white rounded-2xl p-0.5 shadow-lg flex gap-0.5 max-w-2xl mx-auto">
          <button
            onClick={() => setView('score')}
            className={`flex-1 py-1.5 px-1 rounded-xl font-medium transition-all text-xs ${
              view === 'score'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-1">
              <Sparkles size={14} />
              <span className="whitespace-nowrap">FP</span>
            </div>
          </button>
          <button
            onClick={() => setView('leaderboard')}
            className={`flex-1 py-1.5 px-1 rounded-xl font-medium transition-all text-xs ${
              view === 'leaderboard'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-1">
              <Trophy size={14} />
              <span className="whitespace-nowrap">Leaderboard</span>
            </div>
          </button>
          <button
            onClick={() => setView('info')}
            className={`flex-1 py-1.5 px-1 rounded-xl font-medium transition-all text-xs ${
              view === 'info'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-1">
              <Award size={14} />
              <span className="whitespace-nowrap">$FLOW</span>
            </div>
          </button>
        </div>
      </div>

      {/* No User Modal - Shows when user is not in database */}
      {showNoUserModal && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 z-50 transition-opacity"
            onClick={() => setShowNoUserModal(false)}
          />
          
          {/* Modal */}
          <div 
            className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up"
            style={{ paddingBottom: `${Math.max(safeAreaBottom, 0)}px` }}
          >
            <div className="bg-gradient-to-br from-white via-gray-50 to-white rounded-t-3xl shadow-2xl max-w-2xl mx-auto">
              {/* Grab Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1 bg-gray-300 rounded-full" />
              </div>

              {/* Content */}
              <div className="px-6 py-8 text-center">
                <div className="text-6xl mb-6">🌀</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  You have 0 Flow Points
                </h3>
                <p className="text-lg text-gray-600 mb-8">
                  Go Earn Flow Points
                </p>
                
                {/* Action Button */}
                <button
                  onClick={() => {
                    actions.openUrl('https://farcaster.xyz/miniapps/0JqfZe0oRgF8/flow');
                    setShowNoUserModal(false);
                  }}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-4 px-6 rounded-2xl shadow-lg transition-all transform hover:scale-[1.02]"
                >
                  Earn Flow Points
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
} 