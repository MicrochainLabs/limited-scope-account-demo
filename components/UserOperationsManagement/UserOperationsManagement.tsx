"use client"

import { Badge, Button, Container, Group, TagsInput, TextInput, Text, Loader, MultiSelectProps, Avatar, MultiSelect } from '@mantine/core';
import { useForm } from '@mantine/form';
import { createPublicClient, http, isAddress } from 'viem';
import { useState } from 'react';
import { sendOneUserOperationWithPaymaster } from './SendOneUserOperation';
import { sendTwoUserOperationWithPaymaster } from './SendTwoUserOperation';
import classes from '../WelcomeTo/WelcomeTo.module.css';
import { deployNewAccountWithPaymaster } from './DeployNewAccount';
import { normalize } from 'viem/ens'
import { mainnet } from 'viem/chains'




interface Props {
    accountAddress: string
}

const usersData: Record<string, { image: string, addresses:string[] }> = {
  'Uniswap': {
    image: '/uniswap-uni-logo.png',
    addresses:["0xE592427A0AEce92De3Edee1F18E0157C05861564"]
  },
  'USDC': {
    image: '/usd-coin-usdc-logo.png',
    addresses:["0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582"]
  },
  'MyToken (MTK)': {
    image: '/empty-token.webp', //"",
    addresses:["0xEAd18b006203059D51933e6aDcDEdb8b5CE526E1"]
  },
  'USDT': {
    image: '/tether-usdt-logo.png',
    addresses:["0xc2132D05D31c914a87C6611C10748AEb04B58e8F"]
  },
  'DAI': {
    image: '/multi-collateral-dai-dai-logo.png',
    addresses:["0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063"]
  },
  'AAVE': {
    image: '/aave-aave-logo.png',
    addresses:["0xD6DF932A45C0f255f85145f286eA0b292B21C90B"]
  },
  'Ethereum Name Service (ENS)': {
    image: '/ethereum-name-service-ens-logo.png',
    addresses:[]
  },
  'Compound': {
    image: '/compound-comp-logo.png',
    addresses:["0x8505b9d2254A7Ae468c0E9dd10Ccea3A837aef5c"]
  },
};


export function UserOperationsManagement(props: Props) {

  const [accountCreationTransaction, setAccountCreationTransaction] = useState("");

  const [sendEthTransaction, setSendEthTransaction] = useState("");
  const [sendEthAndErc20Transaction, setSendEthAndErc20Transaction] = useState("");

  const [accountAddress, setAccountAddress] = useState("");

  const [isAccountDeployment, setIsAccountDeployment] = useState(true);
  const [isTransaction, setIsTransaction] = useState(false);
  const [isTransactionLoading, setIsTransactionLoading] = useState(false);
  const [isSendEthTransactionLoading, setIsSendEthTransactionLoading] = useState(false);
  const [isSendEthAndErc20Transaction, setIsSendEthAndErc20Transaction] = useState(false);
  
  const accountDeployementForm = useForm({
        mode: 'uncontrolled',
        initialValues: {
          smartContractAddresses: [],
          toAddresses: [],
          onchainProtocols: []
        },

        validate: (values) => {
            return {
              toAddresses: !values.toAddresses.every((address: string) => isAddress(address)) ? 'Invalid smart contract address' : null,
              smartContractAddresses: !values.smartContractAddresses.every((address: string) => isAddress(address)) ? 'Invalid smart contract address' : null,
            };
        },
  });

  const transferNativeCoinForm = useForm({
    mode: 'uncontrolled',
    initialValues: {
      accountAddress: '',
      amount: '',
    },

    validate: (values) => {
        return {
            accountAddress: !isAddress(values.accountAddress) ? 'Invalid account address' : null,
          };
    },
  });

  const batchTransactionsForm = useForm({
    mode: 'uncontrolled',
    initialValues: {
      nativeCoinTransferAccountAddress: '',
      nativeCoinTransferamount: '',
      erc20Address: '',
      erc20ReceiverAccountAddress: '',
      erc20Transferamount: '',
    },

    validate: (values) => {
        return {
          nativeCoinTransferAccountAddress: !isAddress(values.nativeCoinTransferAccountAddress) ? 'Invalid account address' : null,
          erc20ReceiverAccountAddress: !isAddress(values.erc20ReceiverAccountAddress) ? 'Invalid account address' : null,
          erc20Address: !isAddress(values.erc20Address) ? 'Invalid account address' : null,
        };
    },
  });

  async function deployNewAccount() {    
    const publicClient = createPublicClient({
      transport: http("https://gateway.tenderly.co/public/mainnet	"),
      chain: mainnet
    })

    const smartContractAddresses= accountDeployementForm.getValues().onchainProtocols.map(onChainProtocol => usersData[onChainProtocol].addresses).flat()
    const toAddresses = await Promise.all(accountDeployementForm.getValues().toAddresses.map(async (account) => await isAddress(account)? account : publicClient.getEnsResolver({
      name: normalize(account)
    })));


    setIsTransactionLoading(true)
    const account= await deployNewAccountWithPaymaster(smartContractAddresses, toAddresses)
    console.log("account: ",account)
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: Unreachable code error
    BigInt.prototype["toJSON"] = function () {
      return this.toString();
    };
    localStorage.setItem("account",  JSON.stringify(account));
    setAccountAddress(account.accountIdentifier)
    setAccountCreationTransaction(account.txHash)
    setIsTransactionLoading(false)
  }

  async function sendUserOperation() {
    if (typeof window !== "undefined") {
      const account = JSON.parse(localStorage.getItem("account") || "");
      setIsSendEthTransactionLoading(true)
      const result= await sendOneUserOperationWithPaymaster(transferNativeCoinForm.getValues().accountAddress, transferNativeCoinForm.getValues().amount, account.accountIdentifier, account.ownerPrivateKey, account.accountAllowedSmartContracts, account.accountAllowedToTree)
      setSendEthTransaction(result.txHash)
      setIsSendEthTransactionLoading(false)
    }
  }

  async function sendTwoUserOperations() {
    if (typeof window !== "undefined") {
      const account = JSON.parse(localStorage.getItem("account") || "");
      setIsSendEthAndErc20Transaction(true)
      const result= await sendTwoUserOperationWithPaymaster(batchTransactionsForm.getValues().nativeCoinTransferAccountAddress, batchTransactionsForm.getValues().nativeCoinTransferamount, batchTransactionsForm.getValues().erc20Address, batchTransactionsForm.getValues().erc20ReceiverAccountAddress, batchTransactionsForm.getValues().erc20Transferamount, account.accountIdentifier, account.ownerPrivateKey, account.accountAllowedSmartContracts, account.accountAllowedToTree)
      setSendEthAndErc20Transaction(result.txHash)
      setIsSendEthAndErc20Transaction(false)
    }
  }

  async function nextStep(step: string){
    if(step == "1"){
      setIsAccountDeployment(true)
      setIsTransaction(false)
    }else if(step == "2"){
      setIsAccountDeployment(false)
      setIsTransaction(true)
    }
  }

  const renderMultiSelectOption: MultiSelectProps['renderOption'] = ({ option }) => (
    <Group gap="sm">
      <Avatar src={usersData[option.value].image} size={36} radius="xl" />
      <div>
        <Text size="sm">{option.value}</Text>
      </div>
    </Group>
  );

  return (
    <>
     <Container size={1000}  ta="center">

     
      {isAccountDeployment && ( <div>
        <Container size={700} className={classes.inner} ta="center">
          <Text className={classes.description} color="dimmed" pb={'xs'} >
            Set up account scope || Deploy a new account(Amoy testnet)
          </Text>
        </Container>
        <MultiSelect
          data={['Uniswap', 'USDC', 'USDT', 'DAI', 'AAVE', 'Ethereum Name Service (ENS)', 'Compound', 'MyToken (MTK)']}
          renderOption={renderMultiSelectOption}
          key={accountDeployementForm.key('onchainProtocols')}
          {...accountDeployementForm.getInputProps('onchainProtocols')}
          maxDropdownHeight={300}
          label="Account scope: On-chain protocols"
          placeholder="Search for protocol"
        />

        <TagsInput
            label="Account scope: Value transfer"
            description="Press Enter to submit an address or ENS name"
            placeholder="Enter addresses or an ENS name for who your account is allowed to send value(native coin and ERC20 token)"
            key={accountDeployementForm.key('toAddresses')}
            {...accountDeployementForm.getInputProps('toAddresses')}
            maxTags={3}
        />

        <Group justify="center" mt="xl">
            <Button
            onClick={deployNewAccount}
            >
            Deploy new account
            </Button>
            
        </Group>

        {isTransactionLoading && ( <div>
        <Loader color="blue" mt={'xl'}/>
        </div>
        )}

        {accountCreationTransaction && ( <div>
          <Badge color={"green"} variant="light" mt={'xl'} size="35">
            <Text size='xl'>
              Transaction:  
              <a href={`https://amoy.polygonscan.com/tx/${accountCreationTransaction}`} target="_blank">
                  {accountCreationTransaction}
              </a>
            </Text>
            </Badge>
            <br/>
            <Badge color={"cyan"} variant="light" mt={'xl'} size="35">
              <Text size='xl' /*fw={700}*/>
                Account address:
                <a href={`https://amoy.polygonscan.com/address/${accountAddress}`} target="_blank">
                  {accountAddress}
              </a>
              </Text>
            </Badge>
            <br/>
          <Button onClick={()=>nextStep("2")} mt={'xl'}>Next step</Button>
        </div>
          
        )}
        </div>
      )}
      {isTransaction && ( <div>
        <Badge
          size="xl"
          variant="gradient"
          gradient={{ from: 'blue', to: 'cyan', deg: 90 }}
          h={36}
          mb={'xl'}
        >
          Example 1: Native token transfer
        </Badge>

        <TextInput
            label="Account address"
            placeholder="Account address"
            key={transferNativeCoinForm.key('accountAddress')}
            {...transferNativeCoinForm.getInputProps('accountAddress')}
        />

        <TextInput
            label="Amount(ETH)"
            placeholder="Amount(ETH)"
            key={transferNativeCoinForm.key('amount')}
            {...transferNativeCoinForm.getInputProps('amount')}
        />

        <Group justify="center" mt="xl">
            <Button
            onClick={sendUserOperation}
            >
            Submit
            </Button>
        </Group>
        {isSendEthTransactionLoading && ( <div>
        <Loader color="blue" mt={'xl'}/>
        </div>
        )}
        {sendEthTransaction && ( <div>
          <Badge color={"green"} variant="light" mt={'xl'} size="35">
          <Text size='xl'>
            Transaction:  
            <a href={`https://amoy.polygonscan.com/tx/${sendEthTransaction}`} target="_blank">
                {sendEthTransaction}
            </a>
          </Text>
          </Badge>
        </div>)}
        <Badge
          size="xl"
          variant="gradient"
          gradient={{ from: 'blue', to: 'cyan', deg: 90 }}
          mt={'xl'}
          h={36}
          mb={'xl'}
        >
          Example 2: Batch Transactions(Native coin transfer + ERC20 token transfer)
        </Badge>
        <br/>
        <Text fw={700}>Transaction 1: Native coin transfer</Text>
        <TextInput
            label="Account address"
            placeholder="Account address"
            key={batchTransactionsForm.key('nativeCoinTransferAccountAddress')}
            {...batchTransactionsForm.getInputProps('nativeCoinTransferAccountAddress')}
        />

        <TextInput
            label="Amount(ETH)"
            placeholder="Amount(ETH)"
            key={batchTransactionsForm.key('nativeCoinTransferamount')}
            {...batchTransactionsForm.getInputProps('nativeCoinTransferamount')}
        />
        <Text fw={700}>Transaction 2: ERC20 token transfer</Text>

        <TextInput
            label="ERC20 token address"
            placeholder="ERC20 token address "
            key={batchTransactionsForm.key('erc20Address')}
            {...batchTransactionsForm.getInputProps('erc20Address')}
        />

        <TextInput
            label="Receiver account address"
            placeholder="Receiver account address"
            key={batchTransactionsForm.key('erc20ReceiverAccountAddress')}
            {...batchTransactionsForm.getInputProps('erc20ReceiverAccountAddress')}
        />

        <TextInput
            label="Amount"
            placeholder="Amount"
            key={batchTransactionsForm.key('erc20Transferamount')}
            {...batchTransactionsForm.getInputProps('erc20Transferamount')}
        />

        <Group justify="center" mt="xl">
            <Button
            onClick={sendTwoUserOperations}
            >
            Submit
            </Button>
        </Group>
        {isSendEthAndErc20Transaction && ( <div>
        <Loader color="blue" mt={'xl'}/>
        </div>
        )}
         {sendEthAndErc20Transaction && ( <div>
          <Badge color={"green"} variant="light" mt={'xl'} size="35">
          <Text size='xl'>
            Transaction:  
            <a href={`https://amoy.polygonscan.com/tx/${sendEthAndErc20Transaction}`} target="_blank">
                {sendEthAndErc20Transaction}
            </a>
          </Text>
          </Badge>
        </div>)}
        </div>
      )}
    </Container>
    </>
  );
}