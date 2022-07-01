# ACDM Market + DAO + Staking

You can find deployed ACDM Platform here:
https://rinkeby.etherscan.io/address/0x5e751d91933d0a45b33563657e56d4846c877051#code

ACDM Token is here:
https://rinkeby.etherscan.io/token/0x0028f68a09B54743232eEE1595DDF2AB00dE3A68

Reward Token is your reward for staking and can be found here:
https://rinkeby.etherscan.io/address/0xEe8B3CdCECF1ED80cE437e26211778d44201B994

Vote Token is LP token from pair (WETH, Reward Token) and it is used in DAO:
https://rinkeby.etherscan.io/address/0x4EA5672f9B5412ED63C8c6d6195DF3Faaa2CBBE5

# ACDM Platform Description

In current implementation the platform contains all parts in one contract: ACDM Market + ReferralProgram + DAO + StakingPlatform.
However, if you need you can separate them in 2 contracts: ACDM Market + ReferralProgram and DAO + StakingPlatform.

The difference will be in the first configuration only.

To perform any changes in the ACDM Platform (any of its part) a caller should have CONFIGURATOR_ROLE.
This role is given to the ACDM Platform itself to make it possible to do changes via DAO votings.

Staked tokens are used as deposit for DAO logic, so weight of user's vote equals to amount of staked tokens.

ACDM Platform has 2 rounds: sale and trade.
During the sale round users can buy ACDM tokens from the platform. The price changes from round to round and amount depends on the volume during the trade round.
During the trade round users can sell to and buy from other users using list/unlist logic.

ACDM Platform also has ReferralProgram which allows to users to specify referral during registration.
It gives bonuses for referrals instead of bonuses for the platform.

Bonuses of the platform can't be withdrawn until the community votes for it.
Another option for the platform's bonus is to convert ETH to Reward Token (using uniswap liquidity pool) and burn them. 
