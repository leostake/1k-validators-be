import { NumberResult } from "../../types";
import ChainData, { chaindataLabel } from "../chaindata";
import logger from "../../logger";

export const getCommission = async (
  chaindata: ChainData,
  validator: string,
): Promise<NumberResult> => {
  try {
    await chaindata.checkApiConnection();
    const prefs = await chaindata?.api?.query.staking.validators(validator);
    if (!prefs) {
      return [0, "No preferences found."];
    }
    return [prefs.commission.toNumber(), null];
  } catch (e) {
    logger.error(`Error getting commission: ${e}`, chaindataLabel);
    return [0, JSON.stringify(e)];
  }
};

export const getCommissionInEra = async (
  chaindata: ChainData,
  apiAt: any,
  eraIndex: number,
  validator: string,
): Promise<number | null> => {
  try {
    await chaindata.checkApiConnection();
    const prefs = await apiAt?.query?.staking.erasValidatorPrefs(
      eraIndex,
      validator,
    );
    return prefs?.commission?.toNumber();
  } catch (e) {
    logger.error(`Error getting commission in era: ${e}`, chaindataLabel);
    return null;
  }
};

export const getBlocked = async (
  chaindata: ChainData,
  validator: string,
): Promise<boolean> => {
  try {
    await chaindata.checkApiConnection();
    const rawPrefs = await chaindata?.api?.query.staking.validators(validator);
    return rawPrefs?.blocked?.toString() === "true";
  } catch (e) {
    logger.error(`Error getting blocked: ${e}`, chaindataLabel);
    return false;
  }
};

export const getBondedAmount = async (
  chaindata: ChainData,
  stash: string,
): Promise<NumberResult> => {
  try {
    await chaindata.checkApiConnection();
    const bondedAddress = await chaindata?.api?.query.staking.bonded(stash);
    if (!bondedAddress || bondedAddress.isNone) {
      return [0, "Not bonded to any account."];
    }

    const ledger: any = await chaindata?.api?.query.staking.ledger(
      bondedAddress.toString(),
    );
    if (!ledger || ledger.isNone) {
      return [0, `Ledger is empty.`];
    }

    return [ledger.toJSON().active, null];
  } catch (e) {
    logger.error(`Error getting bonded amount: ${e}`, chaindataLabel);
    return [0, JSON.stringify(e)];
  }
};

export const getControllerFromStash = async (
  chaindata: ChainData,
  stash: string,
): Promise<string | null> => {
  try {
    await chaindata.checkApiConnection();
    const controller = await chaindata?.api?.query.staking.bonded(stash);
    if (!controller) {
      return null;
    }
    return controller.toString();
  } catch (e) {
    logger.error(`Error getting controller from stash: ${e}`, chaindataLabel);
    return null;
  }
};

export const getRewardDestination = async (
  chaindata: ChainData,
  stash: string,
): Promise<string | null> => {
  try {
    await chaindata.checkApiConnection();
    const rewardDestination: any =
      await chaindata.api?.query.staking.payee(stash);
    if (rewardDestination.toJSON().account) {
      return rewardDestination.toJSON().account;
    } else {
      return rewardDestination.toString();
    }
  } catch (e) {
    logger.error(`Error getting reward destination: ${e}`, chaindataLabel);
    return null;
  }
};

export const getRewardDestinationAt = async (
  chaindata: ChainData,
  apiAt: any,
  stash: string,
): Promise<string | null> => {
  try {
    await chaindata.checkApiConnection();
    const rewardDestination: any = await apiAt.query.staking.payee(stash);
    if (rewardDestination.toJSON().account) {
      return rewardDestination.toJSON().account;
    } else {
      return rewardDestination.toString();
    }
  } catch (e) {
    logger.error(`Error getting reward destination: ${e}`, chaindataLabel);
    return null;
  }
};

export interface QueuedKey {
  address: string;
  keys: string; // Hex representation of the keys
}

export const getQueuedKeys = async (
  chaindata: ChainData,
): Promise<QueuedKey[]> => {
  try {
    await chaindata.checkApiConnection();
    const queuedKeys = await chaindata.api?.query.session.queuedKeys();
    if (!queuedKeys) {
      return [];
    }
    const keys = queuedKeys.map(([validator, keys]) => {
      return {
        address: validator.toString(),
        keys: keys.toHex(),
      };
    });
    return keys;
  } catch (e) {
    logger.error(`Error getting queued keys: ${e}`, chaindataLabel);
    return [];
  }
};

export interface NextKeys {
  keys: {
    grandpa: string;
    babe: string;
    imOnline: string;
    paraValidator: string;
    paraAssignment: string;
    authorityDiscovery: string;
    beefy: string;
  };
}

export const getNextKeys = async (
  chaindata: ChainData,
  stash: string,
): Promise<NextKeys | null> => {
  try {
    await chaindata.checkApiConnection();
    const nextKeysRaw = await chaindata.api?.query.session.nextKeys(stash);
    if (!nextKeysRaw) {
      return null;
    }
    const nextKeysData = nextKeysRaw.toJSON();

    if (nextKeysData && typeof nextKeysData === "object") {
      // Check if the object is not empty
      if (Object.keys(nextKeysData).length > 0) {
        return { keys: nextKeysData } as NextKeys;
      } else {
        return null;
      }
    }
  } catch (e) {
    logger.error(`Error getting next keys: ${e}`, chaindataLabel);
  }
  return null;
};

export interface Balance {
  free: string;
}

export const getBalance = async (
  chaindata: ChainData,
  address: string,
): Promise<Balance | null> => {
  try {
    await chaindata.checkApiConnection();
    const accountData = await chaindata.api?.query.system.account(address);
    if (!accountData) {
      return null;
    }
    const balance: Balance = {
      free: accountData?.data?.free?.toString(),
    };
    return balance;
  } catch (e) {
    logger.error(`Error getting balance: ${e}`, chaindataLabel);
    return null;
  }
};

export interface Stake {
  address: string;
  bonded: number;
}

export interface Exposure {
  total: number;
  own: number;
  others: Stake[];
}

export const getExposure = async (
  chaindata: ChainData,
  eraIndex: number,
  validator: string,
): Promise<Exposure | null> => {
  try {
    await chaindata.checkApiConnection();
    const denom = await chaindata.getDenom();
    const eraStakers = await chaindata.api?.query.staking.erasStakers(
      eraIndex,
      validator,
    );
    if (eraStakers && denom) {
      const total = parseFloat(eraStakers.total.toString()) / denom;
      const own = parseFloat(eraStakers.own.toString()) / denom;

      const activeExposure: Stake[] = eraStakers.others.map(
        (stake: {
          who: { toString: () => string };
          value: { toString: () => string };
        }) => ({
          address: stake.who.toString(),
          bonded: parseFloat(stake.value.toString()) / denom,
        }),
      );

      return {
        total,
        own,
        others: activeExposure,
      };
    }

    return null;
  } catch (e) {
    logger.error(`Error getting exposure: ${e}`, chaindataLabel);
    return null;
  }
};

export const getExposureAt = async (
  chaindata: ChainData,
  apiAt: any,
  eraIndex: number,
  validator: string,
): Promise<Exposure | null> => {
  try {
    await chaindata.checkApiConnection();
    const denom = await chaindata.getDenom();
    const eraStakers = await apiAt.query.staking.erasStakers(
      eraIndex,
      validator,
    );
    if (eraStakers && denom) {
      const total = parseFloat(eraStakers.total.toString()) / denom;
      const own = parseFloat(eraStakers.own.toString()) / denom;
      // @ts-ignore
      const activeExposure = eraStakers.others.toJSON().map((stake) => {
        return {
          address: stake.who.toString(),
          bonded: stake.value / denom,
        };
      });
      return {
        total: total,
        own: own,
        others: activeExposure,
      };
    }
    return null;
  } catch (e) {
    logger.error(`Error getting exposure: ${e}`, chaindataLabel);
    return null;
  }
};
