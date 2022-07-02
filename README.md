# Staking with whitelist for ACDM Market + DAO

Here is a deep copy of another repo, but with implementation of whitelist for staking platform (stake function), which is based on MerkleTree.

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
