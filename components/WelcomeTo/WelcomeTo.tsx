"use client"

import { Container, Text, Button, Group, Center } from '@mantine/core';
import classes from './WelcomeTo.module.css';
import { Welcome } from '../Welcome/Welcome';
import { useState } from 'react';

export function WelcomeTo() {
  
  return (
    <div className={classes.wrapper}>
        <Welcome />
    </div>
  );
}